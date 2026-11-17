import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1>BandiMatch</h1>
        <p className="muted">
          Accedi alla piattaforma di matching clienti ↔ bandi.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
