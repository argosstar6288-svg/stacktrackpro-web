import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type ServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function parseServiceAccount(): ServiceAccountShape | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccountShape;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
    return JSON.parse(decoded) as ServiceAccountShape;
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

const serviceAccount = parseServiceAccount();

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(
        serviceAccount
          ? {
              credential: cert(serviceAccount as any),
              projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
            }
          : {
              credential: applicationDefault(),
              projectId: process.env.FIREBASE_PROJECT_ID,
            }
      );

export const adminDb = getFirestore(adminApp);
export const adminServerTimestamp = () => FieldValue.serverTimestamp();
