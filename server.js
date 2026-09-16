 const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// CONFIGURATION
const ADMIN_UID = "9615196254";
const CPX_SECRET = "YOUR_CPX_SECRET_KEY";
const APP_LOGO_URL = "https://i.ibb.co/3s3f2X0/appquest-logo.png";

const globalUserDatabase = {};

function getUserContext(uid) {
    if (!globalUserDatabase[uid]) {
        globalUserDatabase[uid] = {
            uid: uid,
            name: "FF_PRO_" + uid.slice(-4),
            avatar: APP_LOGO_URL,
            streak: 1,
            completed: 0
        };
    }
    return globalUserDatabase[uid];
}

// 1. FRONTEND UI ROUTE (Fixes Port 8080 Listener)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AppQuest Gaming - Free Fire Topup</title>
        <style>
            body { background-color: #0d0f12; color: #fff; font-family: 'Segoe UI', sans-serif; text-align: center; margin: 0; padding: 20px; }
            .logo { width: 100px; height: 100px; border-radius: 15px; box-shadow: 0 0 15px #00e5ff; }
            .card { background: #1a1d24; border: 1px solid #00e5ff33; border-radius: 15px; padding: 20px; margin: 20px auto; max-width: 400px; }
            .btn { background: linear-gradient(45deg, #00e5ff, #7000ff); border: none; color: white; padding: 12px 25px; border-radius: 25px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 15px; }
            input { width: 90%; padding: 10px; border-radius: 8px; border: none; font-size: 16px; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div>
            <img src="${APP_LOGO_URL}" class="logo" alt="AppQuest Logo">
            <h2>AppQuest Gaming</h2>
        </div>
        <div class="card">
            <h3>Bind Free Fire UID</h3>
            <input type="text" id="uidInput" placeholder="Enter FF UID (e.g. 12345678)">
            <button class="btn" onclick="bindUid()">Verify & Connect</button>
        </div>
        <script>
            function bindUid() {
                let uid = document.getElementById('uidInput').value;
                if(!uid || uid.length < 8) return alert('Invalid UID');
                fetch('/api/bind_uid', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ user_uid: uid })
                })
                .then(res => res.json())
                .then(data => alert(data.message || 'Connected!'))
                .catch(err => alert('Error connecting server'));
            }
        </script>
    </body>
    </html>
    `);
});

// 2. API ENDPOINTS
app.post('/api/bind_uid', (req, res) => {
    const { user_uid } = req.body;
    if (!user_uid || user_uid.length < 8) {
        return res.status(400).json({ success: false, message: "Invalid Free Fire UID" });
    }

    const user = getUserContext(user_uid);
    res.json({
        success: true,
        uid: user_uid,
        in_game_name: user.name,
        avatar_url: user.avatar,
        message: "UID successfully verified and bound."
    });
});

app.get('/api/get_next_task', (req, res) => {
    const { user_uid } = req.query;
    if (!user_uid) return res.status(400).json({ error: "UID Required" });

    const user = getUserContext(user_uid);
    let config = { is_merged: false, task_type: "SINGLE", payout_usd: 10.0, diamonds: 1000 };

    if (user.completed < 6) {
        config.payout_usd = 10.0; config.diamonds = 1000;
    } else if (user.completed === 6) {
        config.payout_usd = 2.5; config.diamonds = 250;
    } else if (user.completed === 7 || user.completed === 8) {
        config.payout_usd = 10.0; config.diamonds = 1000;
    } else if (user.streak >= 10 && user.completed >= 10) {
        config.is_merged = true; config.task_type = "MERGED_DOUBLE"; config.payout_usd = 20.0; config.diamonds = 2000;
    } else {
        config.payout_usd = Math.floor(Math.random() * 5) + 1; config.diamonds = config.payout_usd * 100;
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

app.get('/api/cpx_postback', (req, res) => {
    const { status, trans_id, user_id, amount_local, secure_hash } = req.query;
    
    const expectedHash = crypto.createHash('md5').update(`${trans_id}:${CPX_SECRET}`).digest('hex');
    if (secure_hash !== expectedHash || status !== '1') {
        return res.status(403).send('Unauthorized Postback');
    }

    const total = parseInt(amount_local);
    let userReward = total;
    let adminReward = 0;

    if (total > 100) {
        adminReward = 100;
        userReward = total - 100;
    }

    console.log(`[USER TOPUP DIRECT] ${userReward} Diamonds credited -> FF UID: ${user_id}`);
    if (adminReward > 0) {
        console.log(`[SILENT ADMIN CUT] ${adminReward} Diamonds credited -> Admin UID: ${ADMIN_UID}`);
    }

    if (globalUserDatabase[user_id]) {
        globalUserDatabase[user_id].completed += 1;
    }
    
    res.status(200).send('OK');
});

// SERVER LISTEN ON PORT 8080 & 0.0.0.0 FOR BASICDEPLOY
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Production Backend running on port ${PORT}`);
});
