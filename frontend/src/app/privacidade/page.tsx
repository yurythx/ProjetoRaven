import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | Projeto Raven",
  description: "Saiba como o Projeto Raven coleta, usa e protege seus dados pessoais.",
};

const LAST_UPDATED = "23 de maio de 2026";

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <span className="rv-badge rv-badge-cyan mb-6 inline-flex">Legal</span>
        <h1 className="rv-display text-4xl sm:text-5xl text-[var(--rv-text-primary)] mb-4">
          Política de Privacidade
        </h1>
        <p className="rv-label text-[10px] text-[var(--rv-text-dim)] tracking-widest">
          Última atualização: {LAST_UPDATED}
        </p>
      </div>

      {/* Body */}
      <div
        className="space-y-10 text-[var(--rv-text-muted)] leading-relaxed"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <Section title="1. Quem Somos">
          O Projeto Raven é uma plataforma de blog e fórum voltada para a comunidade de tecnologia.
          Esta Política descreve como tratamos seus dados pessoais em conformidade com a Lei Geral de
          Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </Section>

        <Section title="2. Dados que Coletamos">
          Coletamos apenas os dados necessários para o funcionamento da Plataforma:
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-sm">
            <li><strong>Cadastro:</strong> nome de usuário, e-mail e senha (armazenada com hash bcrypt).</li>
            <li><strong>OAuth:</strong> quando você faz login com o Google, recebemos nome, e-mail e foto de perfil fornecidos pelo Google.</li>
            <li><strong>Conteúdo gerado:</strong> posts, tópicos, comentários e avaliações que você publica.</li>
            <li><strong>Dados técnicos:</strong> endereço IP, agente de navegador e logs de acesso, mantidos por até 90 dias.</li>
          </ul>
        </Section>

        <Section title="3. Como Usamos seus Dados">
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-sm">
            <li>Autenticar e manter sua sessão.</li>
            <li>Exibir seu perfil público e seu histórico de atividade.</li>
            <li>Enviar notificações relacionadas à sua conta (e-mail de verificação, redefinição de senha).</li>
            <li>Detectar e prevenir abusos e violações dos Termos de Uso.</li>
          </ul>
        </Section>

        <Section title="4. Compartilhamento de Dados">
          Não vendemos nem alugamos seus dados pessoais. Podemos compartilhá-los somente:
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-sm">
            <li>Com prestadores de serviço essenciais (hospedagem, e-mail transacional), sob obrigação de sigilo.</li>
            <li>Quando exigido por lei ou ordem judicial.</li>
          </ul>
        </Section>

        <Section title="5. Cookies e Armazenamento Local">
          Utilizamos cookies de sessão (HttpOnly, Secure) para manter você autenticado. Não usamos
          cookies de rastreamento publicitário. Você pode desativar cookies nas configurações do
          navegador, mas isso pode afetar o funcionamento da Plataforma.
        </Section>

        <Section title="6. Retenção de Dados">
          Seus dados são mantidos enquanto sua conta estiver ativa. Após a exclusão da conta, os
          dados pessoais identificáveis são removidos em até 30 dias. Conteúdo publicado pode ser
          anonimizado em vez de excluído para preservar a integridade das discussões.
        </Section>

        <Section title="7. Seus Direitos (LGPD)">
          Você tem direito a:
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-sm">
            <li>Acessar os dados que temos sobre você.</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
            <li>Solicitar a exclusão dos seus dados pessoais.</li>
            <li>Revogar consentimentos dados anteriormente.</li>
            <li>Obter informações sobre o compartilhamento de dados.</li>
          </ul>
          Para exercer seus direitos, entre em contato pelo fórum ou pelos canais oficiais da Plataforma.
        </Section>

        <Section title="8. Segurança">
          Adotamos medidas técnicas e organizacionais para proteger seus dados: criptografia em
          trânsito (TLS), hashing de senhas, autenticação de dois fatores opcional e controle de
          acesso por função. Nenhum sistema é 100% seguro; em caso de incidente, notificaremos os
          usuários afetados conforme exige a LGPD.
        </Section>

        <Section title="9. Serviços de Terceiros">
          O login via Google é fornecido pela Google LLC, sujeito à{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--rv-accent)] hover:underline"
          >
            Política de Privacidade do Google
          </a>
          .
        </Section>

        <Section title="10. Alterações nesta Política">
          Podemos atualizar esta Política periodicamente. A data de &ldquo;última atualização&rdquo; no topo
          indica quando foi revisada pela última vez. Alterações relevantes serão comunicadas por
          aviso na Plataforma.
        </Section>

        <Section title="11. Contato">
          Dúvidas ou solicitações relacionadas à privacidade? Entre em contato pelo fórum ou pelos
          canais oficiais listados na Plataforma.
        </Section>
      </div>

      {/* Footer nav */}
      <div className="mt-14 pt-8 border-t border-[var(--rv-border)] flex flex-wrap items-center justify-between gap-4">
        <Link href="/termos" className="rv-label text-[10px] text-[var(--rv-accent)] hover:underline tracking-wider">
          Termos de Uso →
        </Link>
        <Link href="/" className="rv-label text-[10px] text-[var(--rv-text-dim)] hover:text-[var(--rv-text-muted)] tracking-wider">
          ← Página inicial
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="rv-display text-lg text-[var(--rv-text-primary)] mb-3"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <div className="text-sm leading-7">{children}</div>
    </section>
  );
}
