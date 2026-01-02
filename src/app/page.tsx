export default function Page() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>IAP Backend</h1>
      <p>JWT-secured IAP API with entitlement granting + App Store Server Notifications v2.</p>
      <ul>
        <li>POST /api/iap/verify (JWT)</li>
        <li>GET /api/iap/status (JWT)</li>
        <li>POST /api/iap/notifications (Apple)</li>
      </ul>
    </main>
  );
}
