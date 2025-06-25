// utils/langDetect.js
async function detectLanguage(text) {
    const { franc } = await import('franc');
    let userLang = 'vi';
    const isEnglish = (text) => /[a-z]{3,}/i.test(text);

    try {
        const langCode = franc(text, { minLength: text, whitelist: ['eng', 'vie'] });

        if (langCode === 'vie') userLang = 'vi';
        else if (langCode === 'eng' || isEnglish(text)) userLang = 'en';
        else userLang = 'en';

        console.log(`Detected user language: ${userLang} (from franc: ${langCode || 'N/A'})`);
    } catch (e) {
        console.warn('Không thể phát hiện ngôn ngữ, mặc định tiếng Việt:', e.message);
        userLang = 'vi';
    }

    return userLang;
}

module.exports = detectLanguage;
