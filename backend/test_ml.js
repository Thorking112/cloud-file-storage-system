async function test() {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;

    console.log("Loading model...");
    const classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
    console.log("Model loaded. Testing...");

    const filename = "invoice_2026.pdf";
    const categories = ['Career', 'Finance', 'Documents', 'Others'];
    
    const cleanName = filename.split('.')[0].replace(/[-_]/g, ' ').toLowerCase();
    
    const out = await classifier(`This document is named ${cleanName}.`, categories, { hypothesis_template: "This document is about {}." });
    console.log("Category Result:", JSON.stringify(out, null, 2));

    const possibleTags = ['invoice', 'receipt', 'resume', 'cv', 'report', 'presentation', 'bill', 'payment', 'job', 'taxes', 'application'];
    const tagOut = await classifier(`This document is named ${cleanName}.`, possibleTags, { multi_label: true, hypothesis_template: "This document contains a {}." });
    console.log("Tag Result:", JSON.stringify(tagOut, null, 2));
}

test();
