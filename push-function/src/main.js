/*
  RASRAS PLASTIC - Push Notifications Function
  =============================================
  الفانكشن دي بتشتغل تلقائيًا كل مرة بيانات النظام تتحدّث على
  Appwrite، وبتبعت إشعار فوري (Firebase Cloud Messaging) لكل
  الأجهزة المسجّلة، لو لقت إشعارات جديدة ماتبعتش لسه.
*/

const { Client, Databases } = require("node-appwrite");
const admin = require("firebase-admin");

let firebaseReady = false;

function ensureFirebase(log){

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

module.exports = async ({ req, res, log, error }) => {

  try{

    ensureFirebase(log);

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    const DATABASE_ID = process.env.RASRAS_DATABASE_ID;
    const STATE_COLLECTION_ID = process.env.FCM_STATE_COLLECTION_ID || "6ab268620008f8da80e7";
    const STATE_DOC_ID = "main";
    const APP_COLLECTION_ID = "app_state";
    const APP_DOC_ID = "main";

    // 1) اقرأ آخر إشعار اتبعت قبل كده (لو موجود)
    let lastNotifiedId = null;

    try{

      const stateDoc = await databases.getDocument(
        DATABASE_ID, STATE_COLLECTION_ID, STATE_DOC_ID
      );

      lastNotifiedId = stateDoc.lastNotifiedId || null;

    }catch(e){

      log("مفيش حالة محفوظة قبل كده - أول تشغيل للفانكشن دي. تفاصيل الخطأ: " + e.message + " | code: " + (e.code||"—") + " | type: " + (e.type||"—"));

    }

    // 2) اقرأ بيانات النظام الحالية
    const appDoc = await databases.getDocument(
      DATABASE_ID, APP_COLLECTION_ID, APP_DOC_ID
    );

    const data = JSON.parse(appDoc.payload || "{}");

    const notifications = data.notifications || [];

    const tokens = (data.fcmTokens || [])
      .map(t => t.token)
      .filter(Boolean);

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

      try{

        await databases.updateDocument(
          DATABASE_ID, STATE_COLLECTION_ID, STATE_DOC_ID,
          { lastNotifiedId: notifications[0].id }
        );

      }catch(updateErr){

        await databases.createDocument(
          DATABASE_ID, STATE_COLLECTION_ID, STATE_DOC_ID,
          { lastNotifiedId: notifications[0].id }
        );

      }

    }

    return res.json({ ok:true, sent:sentCount, newNotifications:newOnes.length });

  }catch(e){

    error("خطأ في الفانكشن: " + e.message);

    return res.json({ ok:false, error:e.message }, 500);

  }

};
