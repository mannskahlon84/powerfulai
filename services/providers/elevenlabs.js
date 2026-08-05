export async function synthesizeWithElevenLabs({
    text,
    language,
    emotion = "neutral",
    style = "conversation"
}) {

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
        throw new Error("ElevenLabs API key missing");
    }


    const voiceId =
        process.env.ELEVENLABS_VOICE_ID ||
        "zcAOhNBS3c14rBihAFp1";
    console.log("[VOICE DEBUG] TTS VOICE ID:", voiceId);


    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "xi-api-key": apiKey
            },

            body: JSON.stringify({

                text,

                model_id:
                "eleven_multilingual_v2",

                voice_settings: {

                    stability: 0.5,

                    similarity_boost: 0.75,

                    style:
                    emotion === "warm"
                    ? 0.5
                    : 0.35,

                    use_speaker_boost:true
                }
            })
        }
    );


    if (!response.ok) {

        throw new Error(
            `ElevenLabs failed: ${response.status}`
        );

    }


    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );


    return {

        success:true,

        provider:"elevenlabs",

        audioContent:
        buffer.toString("base64"),

        format:"mp3"

    };

}