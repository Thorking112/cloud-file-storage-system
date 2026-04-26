async function test() {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;

    console.log("Loading model...");
    const classifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall');
    console.log("Model loaded. Testing...");

    const fileText = "DEEPAK S ds1902@srmist.edu.in | 9043671603 | 2027 Github LinkedIn EDUCATION B.Tech Computer Science";
    
    const categories = ['Resume or CV', 'Financial Invoice or Receipt', 'General Document or Report', 'Other'];
    const inputString = `The following text is from a file: ${fileText}`;

    const out = await classifier(inputString, categories, {
        hypothesis_template: "This text is from a {}."
    });
    console.log("Category Result:", JSON.stringify(out, null, 2));
}

test();
