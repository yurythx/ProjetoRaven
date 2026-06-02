import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso | Projeto Raven",
  description: "Leia os Termos de Uso do Projeto Raven antes de utilizar a plataforma.",
};

const LAST_UPDATED = "23 de maio de 2026";

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <span className="rv-badge rv-badge-purple mb-6 inline-flex">Legal</span>
        <h1 className="rv-display text-4xl sm:text-5xl text-[var(--rv-text-primary)] mb-4">
          Termos de Uso
        </h1>
        <p className="rv-label text-[10px] text-[var(--rv-text-dim)] tracking-widest">
          Última atualização: {LAST_UPDATED}
        </p>
      </div>

      {/* Body */}
      <div
        className="space-y-10 text-[var(--rv-text-muted)] leading-relaxed font-[var(--font-body)]"
      >
        <Section title="1. Aceitação dos Termos">
          Ao acessar ou usar o Projeto Raven (&ldquo;Plataforma&rdquo;), você concorda com estes Termos de Uso.
          Se não concordar com algum ponto, não utilize a Plataforma.
        </Section>

        <Section title="2. Uso Permitido">
          Você pode usar a Plataforma para publicar artigos, participar de fóruns e interagir com
          outros membros, desde que respeite as leis aplicáveis e as regras da comunidade. É
          proibido publicar conteúdo ilegal, difamatório, discriminatório, violento ou que viole
          direitos de terceiros.
        </Section>

        <Section title="3. Contas de Usuário">
          Você é responsável por manter a confidencialidade das suas credenciais e por todas as
          atividades realizadas em sua conta. Notifique-nos imediatamente em caso de uso não
          autorizado.
        </Section>

        <Section title="4. Conteúdo do Usuário">
          Ao publicar conteúdo na Plataforma, você nos concede uma licença não exclusiva, mundial e
          livre de royalties para exibir, reproduzir e distribuir esse conteúdo dentro da Plataforma.
          Você mantém a titularidade dos seus direitos autorais.
        </Section>

        <Section title="5. Moderação e Remoção de Conteúdo">
          Reservamo-nos o direito de remover conteúdo que viole estes Termos ou as diretrizes da
          comunidade, a qualquer momento e sem aviso prévio. Usuários que violem reiteradamente as
          regras poderão ter suas contas suspensas ou excluídas.
        </Section>

        <Section title="6. Propriedade Intelectual">
          O código, o design e os materiais originais da Plataforma são propriedade do Projeto Raven.
          Nenhum conteúdo da Plataforma pode ser reproduzido, distribuído ou modificado sem
          autorização prévia e por escrito.
        </Section>

        <Section title="7. Limitação de Responsabilidade">
          A Plataforma é fornecida &ldquo;no estado em que se encontra&rdquo;. Não garantimos disponibilidade
          ininterrupta, ausência de erros ou adequação a um propósito específico. Em nenhuma hipótese
          seremos responsáveis por danos indiretos, incidentais ou consequenciais decorrentes do uso
          da Plataforma.
        </Section>

        <Section title="8. Alterações nos Termos">
          Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas por
          aviso na Plataforma. O uso contínuo após a publicação das alterações constitui aceitação
          dos novos Termos.
        </Section>

        <Section title="9. Lei Aplicável">
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
          da comarca do domicílio do usuário para dirimir quaisquer controvérsias, ressalvados os
          casos em que a lei determinar foro diverso.
        </Section>

        <Section title="10. Contato">
          Dúvidas sobre estes Termos? Entre em contato pelo fórum ou pelos canais oficiais listados
          na Plataforma.
        </Section>
      </div>

      {/* Footer nav */}
      <div className="mt-14 pt-8 border-t border-[var(--rv-border)] flex flex-wrap items-center justify-between gap-4">
        <Link href="/privacidade" className="rv-label text-[10px] text-[var(--rv-accent)] hover:underline tracking-wider">
          Política de Privacidade →
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
      <h2 className="rv-display text-lg text-[var(--rv-text-primary)] mb-3 font-[var(--font-display)]">
        {title}
      </h2>
      <p className="text-sm leading-7">{children}</p>
    </section>
  );
}
