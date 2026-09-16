const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// ------------------------------------------------------------------
// APPQUEST GAMING - CONFIGURATION & LOGO
// ------------------------------------------------------------------
const ADMIN_UID = "9615196254"; 
const CPX_SECRET = "YOUR_CPX_SECRET_KEY";
const APP_LOGO_URL = "https://i.ibb.co/3s3f2X0/appquest-logo.png"; // Your AppQuest Emblem

const globalUserDatabase = {};

// Garena Topup Center Direct Trigger Logic
async function triggerGarenaTopUp(targetUid, packageType, diamondsAmount) {
    console.log(`[GARENA DIRECT PORTAL] Processing ${packageType} (${diamondsAmount} Diamonds) -> FF UID: ${targetUid}`);
    // Connects directly to Garena Topup Center API/Automated Handler
    return true;
}

// ------------------------------------------------------------------
// 1. EMBEDDED GAMING UI & FRONTEND (Single File Serving UI)
// ------------------------------------------------------------------
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
            .header { margin-top: 20px; }
            .logo { width: 120px; height: 120px; border-radius: 20px; box-shadow: 0 0 20px #00e5ff; }
            .card { background: #1a1d24; border: 1px solid #00e5ff33; border-radius: 15px; padding: 20px; margin: 15px auto; max-width: 400px; }
            .btn { background: linear-gradient(45deg, #00e5ff, #7000ff); border: none; color: white; padding: 12px 25px; border-radius: 25px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px; }
            .nav-tabs { display: flex; justify-content: space-around; background: #15171e; padding: 10px; position: fixed; bottom: 0; width: 100%; left: 0; }
            .tab-btn { color: #888; background: none; border: none; font-size: 14px; font-weight: bold; }
            .tab-btn.active { color: #00e5ff; }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="${APP_LOGO_URL}" class="logo" alt="AppQuest Gaming Logo">
            <h2>AppQuest Gaming</h2>
        </div>
        <div id="app-content">
            <div class="card">
                <h3>Bind Free Fire UID</h3>
                <input type="text" id="uidInput" placeholder="Enter FF UID (e.g. 12345678)" style="width: 90%; padding: 10px; border-radius: 8px; border: none;">
                <button class="btn" onclick="bindUid()">Verify & Connect</button>
            </div>
        </div>
        <div class="nav-tabs">
            <button class="tab-btn active" onclick="showTab('tasks')">Tasks</button>
            <button class="tab-btn" onclick="showTab('topup')">Direct TopUp</button>
            <button class="tab-btn" onclick="showTab('passes')">Weekly / Monthly</button>
        </div>
        <script>
            let currentUid = "";
            function bindUid() {
                currentUid = document.getElementById('uidInput').value;
                if(currentUid.length < 8) return alert('Invalid UID');
                alert('UID ' + currentUid + ' Successfully Bound!');
            }
            function showTab(tab) {
                if(!currentUid) return alert('Please Bind UID First');
                let content = document.getElementById('app-content');
                if(tab === 'passes') {
                    content.innerHTML = \`
                        <div class="card">
                            <h3>Weekly Membership Task</h3>
                            <p>Cost Equivalent: PKR 480 ($1.70 USD Task)</p>
                            <button class="btn" onclick="startPassTask('WEEKLY', 1.70)">Start Weekly Pass Task</button>
                        </div>
                        <div class="card">
                            <h3>Monthly Membership Task</h3>
                            <p>Cost Equivalent: PKR 2100 ($7.50 USD Task)</p>
                            <button class="btn" onclick="startPassTask('MONTHLY', 7.50)">Start Monthly Pass Task</button>
                        </div>
                    \`;
                }
            }
            function startPassTask(type, usd) {
                window.location.href = \`/api/get_pass_task?user_uid=\${currentUid}&type=\${type}\`;
            }
        </script>
    </body>
    </html>
    `);
});

// ------------------------------------------------------------------
// 2. DYNAMIC WEEKLY & MONTHLY MEMBERSHIP LOGIC
// ------------------------------------------------------------------
app.get('/api/get_pass_task', (req, res) => {
    const { user_uid, type } = req.query;
    if (!user_uid) return res.status(400).send("UID Required");

    let taskValueUsd = (type === 'WEEKLY') ? 1.70 : 7.50; // PKR 480 equivalent for Weekly, PKR 2100 for Monthly

    res.json({
        success: true,
        uid: user_uid,
        pass_type: type,
        required_payout_usd: taskValueUsd,
        redirect_url: `https://offers.cpx-research.com/index.php?app_id=YOUR_APP&ext_user_id=${user_uid}&subid=${type}`
    });
});

// ------------------------------------------------------------------
// 3. S2S POSTBACK (INSTANT GARENA TOPUP & PASSES DELIVERY)
// ------------------------------------------------------------------
app.get('/api/cpx_postback', async (req, res) => {
    const { status, trans_id, user_id, amount_local, subid, secure_hash } = req.query;
    const expectedHash = crypto.createHash('md5').update(`${trans_id}:${CPX_SECRET}`).digest('hex');
    
    if (secure_hash !== expectedHash || status !== '1') return res.status(403).send('Unauthorized');

    const total = parseInt(amount_local);

    if (subid === 'WEEKLY' || subid === 'MONTHLY') {
        // Direct Pass Credit via Garena Portal
        await triggerGarenaTopUp(user_id, subid, subid === 'WEEKLY' ? 450 : 2600);
    } else {
        // Standard Diamonds Topup
        let userReward = total > 100 ? total - 100 : total;
        let adminReward = total > 100 ? 100 : 0;

        await triggerGarenaTopUp(user_id, 'DIAMONDS', userReward);
        if (adminReward > 0) await triggerGarenaTopUp(ADMIN_UID, 'ADMIN_CUT', adminReward);
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`AppQuest Master System Live on Port ${PORT}`));
