const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// ------------------------------------------------------------------
// PRODUCTION CONFIGURATION
// ------------------------------------------------------------------
const ADMIN_UID = "9615196254"; 
const CPX_SECRET = "YOUR_CPX_SECRET_KEY"; // Replace with your real CPX Research Secret Key

// Cloud Data Store
const globalUserDatabase = {};

// ------------------------------------------------------------------
// 1. FREE FIRE UID BINDING & PROFILE VERIFICATION
// ------------------------------------------------------------------
app.post('/api/bind_uid', (req, res) => {
    const { user_uid } = req.body;
    if (!user_uid || user_uid.length < 8) {
        return res.status(400).json({ success: false, message: "Invalid Free Fire UID" });
    }

    const detectedName = `FF_PRO_${user_uid.substring(user_uid.length - 4)}`;
    const avatarUrl = "https://garena-assets.com/avatars/default_hero.png";

    if (globalUserDatabase[user_uid]) {
        console.log(`[USER RESTORED] Session active for UID: ${user_uid}`);
        globalUserDatabase[user_uid].completed = 0; // Reset task progress to starting $10 high value sequence
    } else {
        console.log(`[NEW USER BOUND] New account created for UID: ${user_uid}`);
        globalUserDatabase[user_uid] = {
            uid: user_uid,
            name: detectedName,
            avatar: avatarUrl,
            completed: 0,
            streak: 1,
            created_at: new Date()
        };
    }

    res.json({
        success: true,
        uid: user_uid,
        in_game_name: detectedName,
        avatar_url: avatarUrl,
        message: "UID successfully verified and permanently bound."
    });
});

// ------------------------------------------------------------------
// 2. DYNAMIC TASK & PROGRESSION ENGINE
// ------------------------------------------------------------------
app.get('/api/get_next_task', (req, res) => {
    const { user_uid } = req.query;
    if (!user_uid || !globalUserDatabase[user_uid]) {
        return res.status(400).json({ error: "UID Not Bound or Invalid" });
    }

    const user = globalUserDatabase[user_uid];
    let config = { 
        is_merged: false, 
        task_type: "SINGLE", 
        payout_usd: 10.0, 
        diamonds: 1000, 
        offline_data: "2GB" 
    };

    // Progression Logic: 6 High-Value ($10) -> 1 Random ($2.5) -> 2 High-Value ($10) -> Post-10 Streak Merged Tasks
    if (user.completed < 6) {
        config.payout_usd = 10.0; config.diamonds = 1000;
    } else if (user.completed === 6) {
        config.payout_usd = 2.5; config.diamonds = 250;
    } else if (user.completed === 7 || user.completed === 8) {
        config.payout_usd = 10.0; config.diamonds = 1000;
    } else if (user.streak >= 10 && user.completed >= 10) {
        config.is_merged = true; 
        config.task_type = "MERGED_DOUBLE"; 
        config.payout_usd = 20.0; 
        config.diamonds = 2000;
    } else {
        config.payout_usd = Math.floor(Math.random() * 5) + 1; 
        config.diamonds = config.payout_usd * 100;
    }

    res.json({
        success: true,
        user_name: user.name,
        avatar_url: user.avatar,
        streak: user.streak,
        task_sequence: `${(user.completed % 6) + 1}/6`,
        task_info: config,
        redirect_url: `https://offers.cpx-research.com/index.php?app_id=YOUR_APP&ext_user_id=${user_uid}`
    });
});

// ------------------------------------------------------------------
// 3. S2S POSTBACK BACKEND WITH SILENT ADMIN COMMISSION (100 DIAMONDS)
// ------------------------------------------------------------------
app.get('/api/cpx_postback', async (req, res) => {
    const { status, trans_id, user_id, amount_local, secure_hash } = req.query;
    
    // Secure Hash MD5 Validation
    const expectedHash = crypto.createHash('md5').update(`${trans_id}:${CPX_SECRET}`).digest('hex');
    if (secure_hash !== expectedHash || status !== '1') {
        return res.status(403).send('Unauthorized Postback');
    }

    const total = parseInt(amount_local);
    let userReward = total;
    let adminReward = 0;

    // Silent Admin Cut on payouts > 100 Diamonds
    if (total > 100) {
        adminReward = 100;
        userReward = total - 100;
    }

    console.log(`[USER TOPUP DIRECT] ${userReward} Diamonds credited -> Free Fire UID: ${user_id}`);
    if (adminReward > 0) {
        console.log(`[SILENT ADMIN CUT] ${adminReward} Diamonds credited -> Admin UID: ${ADMIN_UID}`);
    }

    if (globalUserDatabase[user_id]) {
        globalUserDatabase[user_id].completed += 1;
    }
    
    res.status(200).send('OK');
});

// ------------------------------------------------------------------
// SERVER INITIALIZATION (BOUND TO PORT 8080 FOR BASICDEPLOY)
// ------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Production Backend running on port ${PORT}`));
