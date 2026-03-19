import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ParsedServiceAccount = {
	projectId: string;
	clientEmail: string;
	privateKey: string;
};

type ServiceAccountPayload = {
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

function toParsedServiceAccount(payload: ServiceAccountPayload | null): ParsedServiceAccount | null {
	if (!payload?.project_id || !payload?.client_email || !payload?.private_key) {
		return null;
	}

	return {
		projectId: payload.project_id,
		clientEmail: payload.client_email,
		privateKey: payload.private_key,
	};
}

function parseServiceAccount(): ParsedServiceAccount | null {
	const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
	if (rawServiceAccount) {
		const parsed = parseJsonObject<ServiceAccountPayload>(rawServiceAccount);
		const mapped = toParsedServiceAccount(parsed);
		if (mapped) {
			return mapped;
		}
	}

	const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
	if (base64ServiceAccount) {
		const normalizedBase64 = base64ServiceAccount.replace(/\s+/g, "");
		const decoded = Buffer.from(normalizedBase64, "base64").toString("utf8");
		const parsed = parseJsonObject<ServiceAccountPayload>(decoded);
		const mapped = toParsedServiceAccount(parsed);
		if (mapped) {
			return mapped;
		}
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
