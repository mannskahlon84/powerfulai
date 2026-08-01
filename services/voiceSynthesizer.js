import { synthesizeWithElevenLabs } from "./providers/elevenlabs.js";
import { synthesizeWithGoogle } from "./providers/google.js";
import { synthesizeWithOpenAI } from "./providers/openai.js";


export async function synthesizeVoice({
    text,
    language,
    provider,
    fallbackProvider,
    emotion = "neutral",
    style = "conversation"
}) {

    const providers = [
        provider,
        fallbackProvider,
        "google"
    ].filter(Boolean);


    for (const selectedProvider of providers) {

        try {

            if (selectedProvider === "elevenlabs") {

                if (!process.env.ELEVENLABS_API_KEY) {
                    continue;
                }

                return await synthesizeWithElevenLabs({
                    text,
                    language,
                    emotion,
                    style
                });

            }


            if (selectedProvider === "openai") {

                if (!process.env.OPENAI_API_KEY) {
                    continue;
                }

                return await synthesizeWithOpenAI({
                    text,
                    language,
                    emotion,
                    style
                });

            }


            if (selectedProvider === "google") {

                return await synthesizeWithGoogle({
                    text,
                    language,
                    emotion,
                    style
                });

            }


        } catch(error){

            console.log(
                `${selectedProvider} failed`,
                error.message
            );

        }

    }


    throw new Error(
        "No TTS provider available"
    );

}
