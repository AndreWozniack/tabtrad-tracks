import {
  Cloud,
  LibraryBig,
  Share2,
  ShieldCheck
} from "lucide-react";

export const featureList = [
  {
    icon: LibraryBig,
    title: "Catálogo por ensaio",
    description:
      "Separe faixas por coreografia, modalidade, grupo ou apresentação."
  },
  {
    icon: ShieldCheck,
    title: "Acesso por usuário",
    description:
      "Cada pessoa entra com login e vê apenas o que foi liberado para ela."
  },
  {
    icon: Share2,
    title: "Links públicos",
    description:
      "Compartilhe uma coleção para alunos ou equipe sem expor toda a conta."
  },
  {
    icon: Cloud,
    title: "Storage barato",
    description:
      "Comece com storage gerenciado e migre para bucket mais barato quando precisar."
  }
] as const;

export const demoLibrary = [
  {
    id: "1",
    title: "Entrada do Grupo",
    artist: "Coletânea Tradicional",
    group: "Adulto Sábado",
    duration: "03:42",
    tags: ["abertura", "palco"],
    visibility: "Equipe"
  },
  {
    id: "2",
    title: "Ritmo de Saída",
    artist: "Quarteto Sul",
    group: "Juvenil",
    duration: "02:58",
    tags: ["final", "competição"],
    visibility: "Público"
  },
  {
    id: "3",
    title: "Passagem Lenta",
    artist: "Instrumental",
    group: "Duo",
    duration: "04:20",
    tags: ["ensaio", "contagem"],
    visibility: "Privado"
  },
  {
    id: "4",
    title: "Giro Central",
    artist: "Banda do Ensaio",
    group: "Adulto Quinta",
    duration: "03:15",
    tags: ["meio", "aula"],
    visibility: "Equipe"
  }
];

export const demoCollections = [
  {
    id: "1",
    name: "Festival de Inverno",
    description: "Músicas aprovadas para a apresentação de julho.",
    trackCount: 12,
    visibility: "Compartilhado"
  },
  {
    id: "2",
    name: "Treino da semana",
    description: "Faixas em uso nas aulas e ajustes de marcação.",
    trackCount: 8,
    visibility: "Interno"
  },
  {
    id: "3",
    name: "Arquivo histórico",
    description: "Coreografias antigas e versões anteriores de ensaio.",
    trackCount: 31,
    visibility: "Privado"
  }
];

export const pricingNotes = [
  "Para começar barato, use Vercel no plano gratuito e Supabase no plano gratuito ou básico.",
  "Se o volume de áudio crescer, mova apenas os arquivos para Cloudflare R2 e mantenha o banco e autenticação no Supabase.",
  "Isso reduz custo sem complicar a parte de usuários e permissões."
];
