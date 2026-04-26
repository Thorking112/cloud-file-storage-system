async function test() {
    const { pipeline, env, cos_sim } = await import('@xenova/transformers');
    env.allowLocalModels = false;

    console.log("Loading model...");
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log("Model loaded. Testing...");

    const fileText = "Tamil English Drawing Sports";
    
    // Compute embeddings for text
    const textOut = await extractor(fileText, { pooling: 'mean', normalize: true });
    
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

    const results = [];
    for (const [cat, desc] of Object.entries(tagDefs)) {
        const catOut = await extractor(desc, { pooling: 'mean', normalize: true });
        // Calculate cosine similarity
        let sim = 0;
        for (let i = 0; i < textOut.data.length; ++i) {
            sim += textOut.data[i] * catOut.data[i];
        }
        results.push({ category: cat, score: sim });
    }

    results.sort((a, b) => b.score - a.score);
    console.log("Category Result:", JSON.stringify(results, null, 2));
}

test();
