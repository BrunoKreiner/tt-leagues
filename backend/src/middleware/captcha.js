/**
 * Cloudflare Turnstile CAPTCHA verification middleware
 */
const verifyTurnstile = async (req, res, next) => {
    const { captchaToken } = req.body;
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    
    // Skip verification if secret key is not configured (development/testing)
    if (!secretKey || secretKey === '1x0000000000000000000000000000000AA') {
        console.warn('Turnstile secret key not configured, skipping verification');
        return next();
    }
    
    if (!captchaToken) {
        return res.status(400).json({ error: 'CAPTCHA verification required' });
    }
    
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: secretKey,
                response: captchaToken,
                remoteip: req.ip || req.connection.remoteAddress
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            console.warn('Turnstile verification failed:', data['error-codes']);
            return res.status(400).json({ error: 'CAPTCHA verification failed' });
        }
        
        next();
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return res.status(500).json({ error: 'CAPTCHA verification error' });
    }
};

/**
 * Honeypot field validation middleware
 * Rejects requests if honeypot field is filled (bot detected)
 */
const validateHoneypot = (req, res, next) => {
    const { website } = req.body;
    
    // If honeypot field is filled, it's likely a bot
    if (website && website.trim() !== '') {
        // Silently reject - don't give bots feedback
        console.warn('Honeypot field filled, bot detected from IP:', req.ip);
        return res.status(400).json({ error: 'Invalid request' });
    }
    
    // Remove honeypot field from body before processing
    delete req.body.website;
    
    next();
};

module.exports = {
    verifyTurnstile,
    validateHoneypot
};
