export default function EnvTest() {
  return (
    <pre>
      {JSON.stringify(
        {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          nodeEnv: process.env.NODE_ENV,
        },
        null,
        2
      )}
    </pre>
  );
}
