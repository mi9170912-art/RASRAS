/*
  RASRAS PLASTIC - Push Notifications Function
  =============================================
  الفانكشن دي بتشتغل تلقائيًا كل مرة بيانات النظام تتحدّث على
  Appwrite، وبتبعت إشعار فوري (Firebase Cloud Messaging) لكل
  الأجهزة المسجّلة، لو لقت إشعارات جديدة ماتبعتش لسه.

  ملحوظة: مش بنستخدم مكتبة node-appwrite هنا - بنكلم الـ REST API
  بتاع Appwrite مباشرة بـ fetch العادي، عشان تفادي باغ داخلي في
  مكتبة الاتصال بتاعتها (node-fetch-native-with-agent).
*/

const admin = require("firebase-admin");

let firebaseReady = false;

function ensureFirebase(){

  if(firebaseReady) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if(!raw){
    throw new Error("متغير FIREBASE_SERVICE_ACCOUNT_JSON مش متظبط في إعدادات الفانكشن");
  }

  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  firebaseReady = true;

}

function appwriteHeaders(){

  return {
    "Content-Type": "application/json",
    "X-Appwrite-Project": process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID,
    "X-Appwrite-Key": process.env.APPWRITE_API_KEY
  };

}

function appwriteBase(){

  const ep = process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;

  return ep.replace(/\/+$/, "");

}

async function getDoc(databaseId, collectionId, docId){

  const url = `${appwriteBase()}/databases/${databaseId}/collections/${collectionId}/documents/${docId}`;

  const res = await fetch(url, { headers: appwriteHeaders() });

  if(!res.ok){

    const body = await res.text();

    const err = new Error(`Appwrite GET فشل (${res.status}): ${body}`);

    err.status = res.status;

    throw err;

  }

  return res.json();

}

async function upsertDoc(databaseId, collectionId, docId, data){

  const updateUrl = `${appwriteBase()}/databases/${databaseId}/collections/${collectionId}/documents/${docId}`;

  const patchRes = await fetch(updateUrl, {
    method: "PATCH",
    headers: appwriteHeaders(),
    body: JSON.stringify({ data })
  });

  if(patchRes.ok) return patchRes.json();

  // مش موجود أصلاً - نعمله
  const createUrl = `${appwriteBase()}/databases/${databaseId}/collections/${collectionId}/documents`;

  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: appwriteHeaders(),
    body: JSON.stringify({ documentId: docId, data })
  });

  if(!createRes.ok){

    const body = await createRes.text();

    throw new Error(`Appwrite CREATE فشل: ${body}`);

  }

  return createRes.json();

}

module.exports = async ({ req, res, log, error }) => {

  try{

    ensureFirebase();

    const DATABASE_ID = process.env.RASRAS_DATABASE_ID;
    const STATE_COLLECTION_ID = process.env.FCM_STATE_COLLECTION_ID || "6ab268620008f8da80e7";
    const STATE_DOC_ID = "main";
    const APP_COLLECTION_ID = "app_state";
    const APP_DOC_ID = "main";

    // 1) اقرأ آخر إشعار اتبعت قبل كده (لو موجود)
    let lastNotifiedId = null;

    try{

      const stateDoc = await getDoc(DATABASE_ID, STATE_COLLECTION_ID, STATE_DOC_ID);

      lastNotifiedId = stateDoc.lastNotifiedId || null;

      log("آخر إشعار اتبعت قبل كده: " + (lastNotifiedId || "مفيش"));

    }catch(e){

      log("مفيش حالة محفوظة قبل كده - أول تشغيل للفانكشن دي. (" + e.message + ")");

    }

    // 2) اقرأ بيانات النظام الحالية
    const appDoc = await getDoc(DATABASE_ID, APP_COLLECTION_ID, APP_DOC_ID);

    const data = JSON.parse(appDoc.payload || "{}");

    const notifications = data.notifications || [];

    const tokens = (data.fcmTokens || [])
      .map(t => t.token)
      .filter(Boolean);

    log(`لقيت ${notifications.length} إشعار و${tokens.length} جهاز مسجّل`);

    if(!notifications.length || !tokens.length){

      return res.json({ ok:true, sent:0, reason:"لا يوجد إشعارات أو أجهزة مسجّلة" });

    }

    // 3) لاقي الإشعارات الجديدة اللي لسه ماتبعتش (القايمة الأحدث فوق)
    let newOnes = [];

    if(lastNotifiedId===null){

      // أول تشغيل - نبعت بس أحدث إشعار عشان متغرقش الأجهزة برسايل قديمة
      newOnes = notifications.slice(0,1);

    }else{

      for(const n of notifications){

        if(n.id===lastNotifiedId) break;

        newOnes.push(n);

      }

    }

    newOnes.reverse(); // نبعتهم بترتيب حصولهم فعليًا (الأقدم الأول)

    let sentCount = 0;

    for(const n of newOnes){

      const message = {

        notification: {
          title: n.title || "🔔 RASRAS PLASTIC",
          body: n.message || ""
        },

        tokens

      };

      try{

        const response = await admin.messaging().sendEachForMulticast(message);

        sentCount += response.successCount;

        log(`اتبعت إشعار "${n.title}" لـ ${response.successCount} جهاز`);

      }catch(sendErr){

        error("خطأ إرسال FCM: " + sendErr.message);

      }

    }

    // 4) سجّل آخر إشعار اتبعت عشان مانكررش نفس الإشعار تاني
    if(notifications[0]){

      await upsertDoc(DATABASE_ID, STATE_COLLECTION_ID, STATE_DOC_ID, {
        lastNotifiedId: notifications[0].id
      });

    }

    return res.json({ ok:true, sent:sentCount, newNotifications:newOnes.length });

  }catch(e){

    error("خطأ في الفانكشن: " + e.message + " | stack: " + (e.stack||"—"));

    return res.json({ ok:false, error:e.message }, 500);

  }

};
