import type { ChatMessage } from '@/types/pia';

export interface PiaResponse {
    messages: ChatMessage[];
}

export async function sendMessageToPia(
    message: string,
    history: ChatMessage[],
): Promise<PiaResponse> {
    console.log('User:', message);
    console.log('History:', history);

    // Temporary response while we build the backend
    return {
        messages: [
            {
                sender: 'pia',
                text: 'AI backend not connected yet.',
            },
        ],
    };
}