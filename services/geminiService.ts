
// Interface used by the app to structure prompts (Text + Images)
// We keep this structure to maintain compatibility with the UI components
interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

// Global queue variables for Serializing Requests
let requestQueue = Promise.resolve();
let lastRequestTime = 0;

// ApiFreeLLM Free API limit is 1 request per 5 seconds.
// Updated configuration based on user request: 5.7s interval, 20 retries.
const RATE_LIMIT_DELAY = 5700; // 5.7s buffer
const MAX_RETRIES = 20; // Updated to 20 attempts
const ERROR_RETRY_DELAY = 5700; // Fixed 5.7s delay between retries

/**
 * Service to interact with ApiFreeLLM.
 * Includes robust error handling, retry logic, and input adaptation.
 */
export const callGenerativeAI = async (prompt: string | Part[]): Promise<string> => {
    let messageContent = '';

    // 1. Adapter: Convert complex prompt structure to simple string for ApiFreeLLM
    if (typeof prompt === 'string') {
        messageContent = prompt;
    } else if (Array.isArray(prompt)) {
        messageContent = prompt
            .map(p => p.text || '')
            .join('\n');

        const hasImages = prompt.some(p => p.inlineData);
        if (hasImages) {
            console.warn("ApiFreeLLM: Imagens foram ignoradas. A versão Free suporta apenas texto.");
        }
    }

    const systemInstruction = "Você é um assistente especializado em educação, focado na criação de Planos Educacionais Individualizados (PEI). Suas respostas devem ser profissionais, bem estruturadas e direcionadas para auxiliar educadores. Sempre que apropriado, considere e sugira estratégias baseadas nos princípios do Desenho Universal para a Aprendizagem (DUA).";
    const finalMessage = `${systemInstruction}\n\n${messageContent}`;

    // 2. Queue Logic to serialize requests (one at a time)
    const currentOperation = requestQueue.then(async () => {
        // Initial Rate Limit Check
        const now = Date.now();
        const timeSinceLast = now - lastRequestTime;
        if (timeSinceLast < RATE_LIMIT_DELAY) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLast));
        }

        let lastError: Error | null = null;

        // 3. Retry Loop (20 times)
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                lastRequestTime = Date.now();

                const response = await fetch('https://apifreellm.com/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        message: finalMessage
                    })
                });

                // 4. Check for Cloudflare/WAF blocks (HTML responses)
                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    const textResponse = await response.text();
                    
                    // If blocked by WAF/Cloudflare, retrying immediately usually won't help, but we try once more after a delay
                    if (response.status === 403 || textResponse.includes("Cloudflare")) {
                        throw new Error("Bloqueio de segurança (WAF/Cloudflare). Se usar VPN ou AdBlock, desative-os.");
                    }
                    
                    throw new Error(`Resposta inválida da API (Status ${response.status}). Conteúdo não é JSON.`);
                }

                const data = await response.json();

                // 5. Handle API Logical Responses
                if (data.status === 'success') {
                    return data.response;
                } else {
                    // Handle Error Responses from API
                    const errorMsg = data.error || 'Erro desconhecido';
                    throw new Error(errorMsg);
                }

            } catch (error) {
                console.error(`Erro na tentativa ${attempt}/${MAX_RETRIES}:`, error);
                lastError = error instanceof Error ? error : new Error(String(error));

                // Check for Network Errors (likely client-side block)
                const isNetworkError = lastError.message.includes("Failed to fetch") || lastError.message.includes("NetworkError");
                
                // Loop logic: wait 5.7s and try again if not the last attempt
                if (attempt < MAX_RETRIES) {
                    console.log(`Aguardando ${ERROR_RETRY_DELAY}ms antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, ERROR_RETRY_DELAY));
                } else {
                     // If it's the last attempt and network error
                     if (isNetworkError) {
                         throw new Error("Falha de conexão persistente. Verifique sua internet ou desative bloqueadores de anúncios (AdBlock/uBlock) que podem estar impedindo a requisição.");
                     }
                }
            }
        }

        // If loop finishes without success
        throw lastError || new Error("Falha na comunicação com a IA após várias tentativas.");
    });

    // Keep queue alive even if this request fails
    requestQueue = currentOperation.catch(() => {});

    return currentOperation;
};
