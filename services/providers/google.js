export async function synthesizeWithGoogle({
    text,
    language
}) {

    let langCode = (language || "en-US").toLowerCase();


    // Normalize language codes
    if (langCode.includes("en")) {
        langCode = "en-in";
    } 
    else if (langCode.startsWith("hi")) {
        langCode = "hi-in";
    } 
    else if (langCode.startsWith("pa")) {
        langCode = "pa-in";
    }
    else if (langCode.startsWith("ar")) {
        langCode = "ar";
    }
    else {
        langCode = langCode.split("-")[0];
    }
    console.log("[VOICE DEBUG] TTS VOICE ID: google-translate-native");


    // Split long text because Google TTS URL has limits
    const chunks =
        text.match(/[^.!?,\r\n]+[.!?,\r\n]*/g)
        || [text];


    const audioBuffers = [];


    for (const chunk of chunks) {

        const url =
        `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(langCode)}&q=${encodeURIComponent(chunk.trim())}`;


        const response = await fetch(url, {

            headers:{
                "User-Agent":
                "Mozilla/5.0"
            }

        });


        if (!response.ok) {

            throw new Error(
                `Google TTS failed: ${response.status}`
            );

        }


        const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );


        audioBuffers.push(buffer);

    }


    const finalBuffer =
    Buffer.concat(audioBuffers);


    return {

        success:true,

        provider:"google",

        audioContent:
        finalBuffer.toString("base64"),

        format:"mp3"

    };

}