import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const grokApiKey = process.env.GROK_API_KEY;
        if (!grokApiKey) {
            return NextResponse.json({
                error: 'GROK_API_KEY not found',
                message: 'Please set the GROK_API_KEY environment variable'
            }, { status: 400 });
        }

        // Test different model names to see what's available
        const modelsToTest = [
            'grok-3-mini',
            'grok-3',
            'grok-beta',
            'grok',
            'grok-2',
            'grok-2-beta',
            'grok-pro',
            'grok-ultra',
            'x-1',
            'x-1-beta',
            'x-1-pro',
            'x-1-ultra'
        ];

        const results = [];

        for (const model of modelsToTest) {
            try {
                console.log(`Testing model: ${model}`);
                
                const response = await fetch('https://api.x.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${grokApiKey}`,
                        'X-Groq-Provider': 'x-ai'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            {
                                role: 'user',
                                content: 'Hello, just testing if this model works.'
                            }
                        ],
                        max_tokens: 10
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    results.push({
                        model: model,
                        status: 'available',
                        response: data.choices?.[0]?.message?.content || 'No content'
                    });
                    console.log(`✅ Model ${model} is available`);
                } else {
                    const errorText = await response.text();
                    results.push({
                        model: model,
                        status: 'error',
                        error: `${response.status}: ${errorText}`
                    });
                    console.log(`❌ Model ${model} failed: ${response.status}`);
                }
            } catch (error) {
                results.push({
                    model: model,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                console.log(`❌ Model ${model} error: ${error}`);
            }
        }

        return NextResponse.json({
            message: 'Model availability test completed',
            timestamp: new Date().toISOString(),
            results: results,
            availableModels: results.filter(r => r.status === 'available').map(r => r.model)
        });

    } catch (error) {
        console.error('Error testing models:', error);
        return NextResponse.json({
            error: 'Failed to test models',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
