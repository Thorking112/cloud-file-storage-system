require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { createClient } = require('@supabase/supabase-js');

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
                size_bytes: req.file.size
            }
        ]);

        if (dbError) throw dbError;

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
            createdAt: file.created_at
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