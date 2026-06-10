export function StatusScreen({ title, message, action }) {
  return (
    <div className="status-screen">
      <div className="status-panel">
        <div className="brand-mark">AI</div>
        <h1>{title}</h1>
        <p>{message}</p>
        {action}
      </div>
    </div>
  );
}
