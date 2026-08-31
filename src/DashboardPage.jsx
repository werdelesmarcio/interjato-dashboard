import { useMemo, useContext } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { FileText, ShieldCheck, TrendingUp, CheckCircle2 } from "lucide-react";
import { DashboardContext } from './Dashboard'; // Contexto para receber os dados

// Funções utilitárias movidas para cá para manter o componente autônomo
const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const [day, month, year] = dateStr.split("/").map(Number);
    return new Date(year, month - 1, day);
};

const monthsSince = (dateStr) => {
    const then = parseDate(dateStr);
    const now = new Date();
    return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
};

const reviewStatus = (dateStr) => {
    const m = monthsSince(dateStr);
    if (m < 8) return { label: "Em dia", color: "#2FD9A8" };
    if (m < 12) return { label: "Revisão próxima", color: "#FFC24D" };
    return { label: "Revisão atrasada", color: "#FF5D5D" };
};

const CARD_STYLE = { background: "#121821", border: "1px solid #1E2836", borderRadius: 10, padding: "15px" };
const CARD_TITLE_STYLE = { fontSize: 11, color: "#8FA0B3", letterSpacing: "0.08em", marginBottom: 8, textAlign: 'center' };
const TOOLTIP_STYLE = { background: '#1A2633', border: '1px solid #33445A', borderRadius: '8px' };
const CHART_HEIGHT = 220;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
    if (percent < 0.05) return null;
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fontFamily="'Oxanium', sans-serif">
            {`%${(percent * 100).toFixed(0)}`}
        </text>
    );
};

const ChartCard = ({ title, children }) => (
    <div className="dashboard-card" style={CARD_STYLE}>
        <div className="mono" style={CARD_TITLE_STYLE}>{title}</div>
        {children}
    </div>
);

// Rosca com legenda embaixo: aproveita toda a largura do card, o que permite
// cards estreitos (2 ou 3 por linha) sem cortar os rótulos.
const DonutChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="42%" innerRadius={50} outerRadius={80} label={renderCustomizedLabel} labelLine={false}>
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, lineHeight: '18px' }} />
        </PieChart>
    </ResponsiveContainer>
);

const MiniBarChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#56667A" fontSize={11} tickLine={false} interval={0} />
            <YAxis stroke="#56667A" fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={90}>
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
            </Bar>
        </BarChart>
    </ResponsiveContainer>
);

export default function DashboardPage() {
    const { documents, auditLogs, nonConformities } = useContext(DashboardContext);

    const stats = useMemo(() => {
        if (!documents || documents.length === 0) return { emDia: 0, revisoesRegistradas: 0, lidos: 0, statusCounts: {}, approvedCount: 0 };
        const emDia = documents.filter((p) => reviewStatus(p.date).label === "Em dia").length;
        const revisoesRegistradas = documents.reduce((total, plan) => total + (plan.revisoes?.length || 0), 0);
        const lidos = documents.filter((plan) => !plan.needsReview).length;
        const approvedCount = documents.filter(p => p.approvedBy !== "Não identificado").length;
        const statusCounts = documents.reduce((acc, doc) => {
            const status = reviewStatus(doc.date).label;
            if (!acc[status]) acc[status] = 0;
            acc[status]++;
            return acc;
        }, {});
        return { emDia, revisoesRegistradas, lidos, statusCounts, approvedCount };
    }, [documents]);

    const reviewChartData = useMemo(() => [
        { name: 'Revisados', value: stats.lidos, color: '#2FD9A8' },
        { name: 'Não Revisados', value: documents.length - stats.lidos, color: '#4FA3FF' },
    ], [stats.lidos, documents.length]);

    const statusChartData = useMemo(() => [
        { name: 'Em dia', value: stats.statusCounts['Em dia'] || 0, color: '#2FD9A8' },
        { name: 'Revisão próxima', value: stats.statusCounts['Revisão próxima'] || 0, color: '#FFC24D' },
        { name: 'Revisão atrasada', value: stats.statusCounts['Revisão atrasada'] || 0, color: '#FF5D5D' },
    ], [stats.statusCounts]);

    const approvalChartData = useMemo(() => [
        { name: 'Aprovados', value: stats.approvedCount, color: '#2FD9A8' },
        { name: 'Pendentes', value: documents.length - stats.approvedCount, color: '#FFC24D' },
    ], [stats.approvedCount, documents.length]);

    const nonConformityChartData = useMemo(() => {
        const uniqueDocIdsWithNc = new Set(nonConformities.map(nc => nc.documentId));
        const docsWithNcCount = documents.filter(d => uniqueDocIdsWithNc.has(d.id)).length;
        const compliantDocsCount = documents.length - docsWithNcCount;
        return [
            { name: 'Conformes', value: compliantDocsCount, color: '#2FD9A8' },
            { name: 'Não-Conformes', value: docsWithNcCount, color: '#FF5D5D' },
        ];
    }, [documents, nonConformities]);

    const auditorViewChartData = useMemo(() => {
        const viewedDocIds = new Set(
            auditLogs
                .filter(log => log.type === 'Revisão' && log.actor?.toLowerCase().includes('auditor'))
                .map(log => log.documentId)
        );
        const viewedCount = documents.filter(d => viewedDocIds.has(d.id)).length;
        const notViewedCount = documents.length - viewedCount;
        return [
            { name: 'Visualizados', value: viewedCount, color: '#4FA3FF' },
            { name: 'Não Visualizados', value: notViewedCount, color: '#56667A' },
        ];
    }, [documents, auditLogs]);

    const timeline = useMemo(() => {
        const events = [];
        documents.forEach((p) => {
          (p.revisoes || []).forEach((r) => events.push({ planId: p.id, planTitle: p.title, ...r }));
        });
        return events.sort((a, b) => parseDate(b.data) - parseDate(a.data)).slice(0, 14);
    }, [documents]);

    return (
        <div className="dashboard-page">
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Dashboard</h1>
            <p style={{ color: "#8FA0B3", fontSize: 12, margin: "0 0 0.75rem" }}>
              Sistema de gestão de documentos SGI do Grupo Interjato, incluindo planos de continuidade, capacidade, instruções de trabalho, políticas, procedimentos, declarações de aplicabilidade e registros.
            </p>

            {/* Grade unica para os 5 graficos: as roscas e as barras dividem as
                mesmas colunas, entao nenhuma linha fica com espaco sobrando. */}
            <div className="dash-charts-grid">
                <ChartCard title="LEITURA DOS DOCUMENTOS"><DonutChart data={reviewChartData} /></ChartCard>
                <ChartCard title="STATUS DAS REVISÕES"><DonutChart data={statusChartData} /></ChartCard>
                <ChartCard title="STATUS DE APROVAÇÃO"><DonutChart data={approvalChartData} /></ChartCard>
                <ChartCard title="CONFORMIDADE (NCs)"><MiniBarChart data={nonConformityChartData} /></ChartCard>
                <ChartCard title="AUDITORIA (LIDO PELO AUDITOR)"><MiniBarChart data={auditorViewChartData} /></ChartCard>
            </div>

            <div className="dash-stats-grid">
              {[
                { label: "Documentos cadastrados", value: documents.length, icon: FileText, accent: "#4FA3FF" },
                { label: "Em dia (revisão < 8 meses)", value: `${stats.emDia}/${documents.length}`, icon: ShieldCheck, accent: "#2FD9A8" },
                { label: "Revisões registradas", value: stats.revisoesRegistradas, icon: TrendingUp, accent: "#FF8F3D" },
                { label: "Revisados por você", value: `${stats.lidos}/${documents.length}`, icon: CheckCircle2, accent: "#B892FF" },
              ].map((s, i) => (
                <div className="dashboard-card" key={i} style={{ ...CARD_STYLE, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#8FA0B3", flex: 1, textAlign: 'center', paddingRight: '8px' }}>{s.label}</span>
                    <s.icon size={15} color={s.accent} />
                  </div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "#E7ECF2", textAlign: 'center' }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 28 }}>
              <div className="mono" style={{ fontSize: 10, color: "#56667A", letterSpacing: "0.08em", marginBottom: 5 }}>LOG DE REVISÕES · MAIS RECENTES</div>
              <div style={{ background: "#0D1218", border: "1px solid #1E2836", borderRadius: 10, padding: "10px 0", overflowX: "auto", whiteSpace: "nowrap" }}>
                {timeline.map((ev, i) => (
                  <span key={i} className="mono" style={{ fontSize: 12, color: "#8FA0B3", padding: "0 18px", borderRight: i < timeline.length - 1 ? "1px solid #1E2836" : "none", display: "inline-block" }}>
                    <span style={{ color: "#56667A" }}>{ev.data}</span>{"  "}
                    <span style={{ color: "#4FA3FF" }}>{ev.planId}</span>{"  "}
                    <span style={{ color: "#E7ECF2" }}>{ev.motivo}</span>
                  </span>
                ))}
              </div>
            </div>
        </div>
    );
}
