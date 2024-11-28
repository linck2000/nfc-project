const functions = require("firebase-functions");
const admin = require("firebase-admin");

// 初始化 Firebase Admin SDK
admin.initializeApp({
  databaseURL: "https://nfccard-c3e48-default-rtdb.firebaseio.com/" // 替換為你的 Firebase Realtime Database URL
});

// 用於生成 Token 並存儲的 Cloud Function
exports.nfcHandler = functions.https.onRequest(async (req, res) => {
  try {
    const tagId = req.query.tagId || "unknown"; // 接收 NFC 標籤 ID
    console.log("Received NFC tag ID:", tagId);

    // 生成唯一 Token
    const token = `TOKEN_${Date.now()}_${Math.random().toString(36).substr(2)}`;
    const expiry = Date.now() + 1800000; // Token 有效期：30 分鐘

    // 將 Token 存入 Firebase Realtime Database
    await admin.database().ref(`tokens/${token}`).set({ tagId, expiry });
    console.log("Token stored in database:", { token, tagId, expiry });

    // 返回動態 URL
    const dynamicUrl = `http://127.0.0.1:5001/nfccard-c3e48/us-central1/verifyToken?token=${token}`;
    res.send(`Dynamic URL: ${dynamicUrl}`);
  } catch (error) {
    console.error("Error in nfcHandler:", error);
    res.status(500).send("Internal server error");
  }
});

// 用於驗證 Token 的 Cloud Function
exports.verifyToken = functions.https.onRequest(async (req, res) => {
  try {
    const token = req.query.token; // 從 URL 中獲取 Token
    console.log("Received token for verification:", token);

    // 檢查是否有 Token
    if (!token) {
      console.log("Error: Missing token");
      return res.status(400).send("Missing token");
    }

    // 從 Firebase Database 獲取 Token 資料
    const snapshot = await admin.database().ref(`tokens/${token}`).once("value");
    if (!snapshot.exists()) {
      console.log("Error: Token not found in database");
      return res.status(400).send("Invalid token");
    }

    const { tagId, expiry } = snapshot.val();
    console.log("Token data fetched from database:", { tagId, expiry });

    // 檢查 Token 是否過期
    if (Date.now() > expiry) {
      console.log("Error: Token expired");
      return res.status(400).send("Token expired");
    }

    // 刪除已使用的 Token
    await admin.database().ref(`tokens/${token}`).remove();
    console.log("Token successfully removed from database");

    // 返回成功訊息
    res.send(`Attendance recorded for tag: ${tagId}`);
  } catch (error) {
    console.error("Error in verifyToken:", error);
    res.status(500).send("Internal server error");
  }
});
