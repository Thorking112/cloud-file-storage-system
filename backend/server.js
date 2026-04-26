require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const app = express();
const port = process.env.PORT || 3000;

// Configure Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Configure Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Set up Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Authentication Middleware
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    
    // Create a specific client perfectly authenticated as THIS user
    const userClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verify the JWT token via Supabase
    const { data: { user }, error } = await userClient.auth.getUser();

    if (error || !user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    req.user = user;
    req.supabase = userClient;
    next();
};

// --- ML Pipeline Initialization ---
let extractor = null;

async function initML() {
    try {
        const { pipeline } = await import('@xenova/transformers');
        console.log("Loading ML Embedding Model (this might take a few seconds on first run)...");
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log("ML Model loaded successfully!");
    } catch (error) {
        console.error("Failed to load ML model:", error);
    }
}
initML();

// Helper for cosine similarity
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
}

// --- File Content Extraction ---
async function extractTextFromFile(buffer, mimetype, filename) {
    try {
        let text = "";
        
        if (mimetype === 'application/pdf') {
            const data = await pdfParse(buffer);
            text = data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
            const result = await mammoth.extractRawText({ buffer: buffer });
            text = result.value;
        } else if (mimetype.includes('excel') || mimetype.includes('spreadsheet') || filename.endsWith('.xlsx') || filename.endsWith('.csv') || filename.endsWith('.xls')) {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            text = xlsx.utils.sheet_to_csv(worksheet);
        }

        if (text) {
            // Clean up and truncate text to prevent overflowing the ML model token limits
            text = text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
            return text.substring(0, 500); 
        }
    } catch (e) {
        console.error("[Text Extraction] Failed to extract text:", e.message);
    }
    return null;
}

// --- ML-based Classification Logic ---
async function classifyFileML(filename, mimetype, fileText) {
    const cleanName = filename.toLowerCase();
    const baseName = cleanName.includes('.') ? cleanName.slice(0, cleanName.lastIndexOf('.')) : cleanName;
    
    // 1. High-confidence heuristic rules
    if (mimetype.includes('image')) return 'Images';
    
    // Heuristics removed. Rely entirely on ML Semantic Embeddings if text exists!

    // 2. ML Fallback (Vector Embedding Semantic Similarity)
    if (!extractor) {
        if (cleanName.endsWith('.pdf') || cleanName.endsWith('.doc') || cleanName.endsWith('.docx')) return 'Documents';
        return 'Others';
    }
    
    try {
        const textToEmbed = fileText ? fileText : baseName.replace(/[-_]/g, ' ');
        const textOut = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
        
        const categoryDefs = {
            'Career': "A resume, CV, or job application containing education, work experience, university degrees, and skills.",
            'Finance': "A financial document such as an invoice, receipt, budget, spreadsheet, payment, or tax form.",
            'Documents': "A general document, report, or academic paper."
        };

        let bestCategory = 'Others';
        let bestScore = -1;

        for (const [cat, desc] of Object.entries(categoryDefs)) {
            const catOut = await extractor(desc, { pooling: 'mean', normalize: true });
            const score = cosineSimilarity(textOut.data, catOut.data);
            if (score > bestScore) {
                bestScore = score;
                bestCategory = cat;
            }
        }
        
        if (bestScore < 0.06) return 'Others';
        return bestCategory;

    } catch (e) {
        console.error("[ML Error]", e.message);
        return 'Others';
    }
}

async function generateTagsML(filename, mimetype, fileText) {
    let baseTags = [];
    const cleanName = filename.toLowerCase();
    const baseName = cleanName.includes('.') ? cleanName.slice(0, cleanName.lastIndexOf('.')) : cleanName;

    if (mimetype.includes('image')) baseTags.push('photo', 'media');

    if (!extractor) return baseTags.length ? baseTags : ['general'];

    const tagDefs = {
        'invoice': "payment request or bill",
        'receipt': "proof of payment or purchase",
        'resume': "summary of work experience and education",
        'cv': "curriculum vitae or job application",
        'report': "detailed document or academic paper",
        'presentation': "slides or pitch deck",
        'payment': "financial transaction or money",
        'job': "employment or hiring",
        'taxes': "government tax form or revenue",
        'dataset': "spreadsheet or raw data",
        'price': "cost or budget"
    };

    try {
        const textToEmbed = fileText ? fileText : baseName.replace(/[-_]/g, ' ');
        const textOut = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
        
        let mlTags = [];
        for (const [tag, desc] of Object.entries(tagDefs)) {
            const tagOut = await extractor(desc, { pooling: 'mean', normalize: true });
            const score = cosineSimilarity(textOut.data, tagOut.data);
            if (score > 0.12) mlTags.push(tag);
        }
        
        const finalTags = [...new Set([...baseTags, ...mlTags])];
        return finalTags.length > 0 ? finalTags : ['general'];
    } catch (e) {
        return baseTags.length ? baseTags : ['general'];
    }
}

app.get('/', (req, res) => {
    res.send('Cloud File Storage Secure Backend Running');
});

// Endpoint to provide public config to frontend
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: supabaseUrl,
        supabaseKey: supabaseKey
    });
});

// Endpoint to upload a file (Protected)
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Convert file buffer to base64
        const file64 = req.file.buffer.toString('base64');
        const fileDataUri = `data:${req.file.mimetype};base64,${file64}`;
        
        // Use a clean filename for public_id, appended with timestamp to avoid collision
        const timestamp = Date.now();
        const safeName = req.file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');

        // Extract text from file content
        const fileText = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
        if (fileText) {
            console.log(`[Upload] Extracted text from ${req.file.originalname}: "${fileText.substring(0, 50)}..."`);
        }

        // Smart Categorization & Tagging (ML based)
        const category = await classifyFileML(req.file.originalname, req.file.mimetype, fileText);
        const tags = await generateTagsML(req.file.originalname, req.file.mimetype, fileText);

        console.log(`[Upload] File: ${req.file.originalname} | Assigned Category: ${category} | Tags: ${tags.join(', ')}`);

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(fileDataUri, { 
            resource_type: 'auto',
            public_id: `user_${req.user.id}/${safeName}_${timestamp}`
        });

        // Save record to Supabase DB mapping to this user (using the auth'd client so RLS allows it)
        const { error: dbError } = await req.supabase.from('files').insert([
            {
                user_id: req.user.id,
                filename: req.file.originalname,
                cloudinary_url: uploadResult.secure_url,
                raw_format: uploadResult.format || 'raw',
                size_bytes: req.file.size,
                category: category,
                tags: tags
            }
        ]);

        if (dbError) {
            console.error('[DB Insert Error]', dbError);
            throw dbError;
        }

        res.json({
            message: 'File securely uploaded and saved!',
            file: {
                name: req.file.originalname,
                url: uploadResult.secure_url
            }
        });

    } catch (error) {
        console.error('Upload Process Error:', error);
        res.status(500).json({ error: 'Failed to process file upload' });
    }
});

// Endpoint to list strictly the user's uploaded files (Protected)
app.get('/api/files', requireAuth, async (req, res) => {
    try {
        // Fetch matching rows from Supabase 'files' table using auth'd client
        const { data, error } = await req.supabase
            .from('files')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map them to match the frontend expectations
        const mappedFiles = data.map(file => ({
            name: file.filename,
            url: file.cloudinary_url,
            createdAt: file.created_at,
            category: file.category || 'Others',
            tags: file.tags || ['general']
        }));

        res.json(mappedFiles);

    } catch (error) {
        console.error('Fetch Files Error:', error);
        res.status(500).json({ error: 'Failed to fetch personal files' });
    }
});

app.listen(port, () => {
    console.log(`Secure server running on port ${port}`);
    console.log(`Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set along with CLOUDINARY credentials.`);
});
