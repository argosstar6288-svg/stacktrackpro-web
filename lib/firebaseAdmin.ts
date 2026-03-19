import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ParsedServiceAccount = {
	projectId: string;
	clientEmail: string;
	privateKey: string;
};

function parseServiceAccount(): ParsedServiceAccount | null {
	const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
	if (rawServiceAccount) {
		const parsed = JSON.parse(rawServiceAccount);
		return {
			projectId: parsed.project_id,
			clientEmail: parsed.client_email,
			privateKey: parsed.private_key,
		};
	}

	const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
	if (base64ServiceAccount) {
		const decoded = Buffer.from(base64ServiceAccount, "base64").toString("utf8");
		const parsed = JSON.parse(decoded);
		return {
			projectId: parsed.project_id,
			clientEmail: parsed.client_email,
			privateKey: parsed.private_key,
		};
	}

	if (
		process.env.FIREBASE_PROJECT_ID &&
		process.env.FIREBASE_CLIENT_EMAIL &&
		process.env.FIREBASE_PRIVATE_KEY
	) {
		return {
			projectId: process.env.FIREBASE_PROJECT_ID,
			clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
			privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
		};
	}

	return null;
}

function getAdminApp() {
	if (getApps().length > 0) {
		return getApps()[0]!;
	}

	const serviceAccount = parseServiceAccount();

	if (serviceAccount) {
		return initializeApp({
			credential: cert({
				projectId: serviceAccount.projectId,
				clientEmail: serviceAccount.clientEmail,
				privateKey: serviceAccount.privateKey,
			}),
			projectId: serviceAccount.projectId,
		});
	}

	return initializeApp({
		credential: applicationDefault(),
		projectId: process.env.FIREBASE_PROJECT_ID,
	});
}

const adminApp = getAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
