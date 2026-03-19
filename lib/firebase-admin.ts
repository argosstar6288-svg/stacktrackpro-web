import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type ServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function parseJsonObject<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parseServiceAccount(): ServiceAccountShape | null {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (rawServiceAccount) {
    const parsed = parseJsonObject<ServiceAccountShape>(rawServiceAccount);
    if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
      return parsed;
    }
  }

  const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64ServiceAccount) {
    const normalizedBase64 = base64ServiceAccount.replace(/\s+/g, "");
    const decoded = Buffer.from(normalizedBase64, "base64").toString("utf8");
    const parsed = parseJsonObject<ServiceAccountShape>(decoded);
    if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
      return parsed;
    }
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
