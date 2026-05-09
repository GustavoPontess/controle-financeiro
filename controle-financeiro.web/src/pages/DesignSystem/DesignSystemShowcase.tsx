import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  Grid,
  Chip,
  Paper,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Eye,
  EyeOff,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Search,
  Copy,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import CustomButton from '../../components/CustomButton';

const colors = {
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  accent: '#6366f1',
};

const chartData = [
  { mes: 'Jan', receita: 2400, despesa: 1400 },
  { mes: 'Fev', receita: 2210, despesa: 1398 },
  { mes: 'Mar', receita: 2290, despesa: 9800 },
  { mes: 'Abr', receita: 2000, despesa: 1800 },
  { mes: 'Mai', receita: 2181, despesa: 1500 },
  { mes: 'Jun', receita: 2500, despesa: 2100 },
];

const pieData = [
  { name: 'Alimentação', value: 35, fill: '#10b981' },
  { name: 'Transporte', value: 25, fill: '#3b82f6' },
  { name: 'Saúde', value: 20, fill: '#f59e0b' },
  { name: 'Outros', value: 20, fill: '#ef4444' },
];

const icons = [
  { name: 'Eye', icon: Eye },
  { name: 'EyeOff', icon: EyeOff },
  { name: 'ChevronDown', icon: ChevronDown },
  { name: 'Plus', icon: Plus },
  { name: 'Trash2', icon: Trash2 },
  { name: 'Edit2', icon: Edit2 },
  { name: 'Check', icon: Check },
  { name: 'X', icon: X },
  { name: 'AlertCircle', icon: AlertCircle },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'TrendingDown', icon: TrendingDown },
  { name: 'DollarSign', icon: DollarSign },
  { name: 'Calendar', icon: Calendar },
  { name: 'Search', icon: Search },
  { name: 'Copy', icon: Copy },
];

interface ColorSwatchProps {
  label: string;
  value: string;
}

const ColorSwatch = ({ label, value }: ColorSwatchProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        cursor: 'pointer',
        p: 2,
        borderRadius: 2,
        border: '1px solid #e5e7eb',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: '#d1d5db',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        },
      }}
      onClick={handleCopy}
    >
      <Box
        sx={{
          width: '100%',
          height: '80px',
          borderRadius: '8px',
          backgroundColor: value,
          border: '1px solid #e5e7eb',
        }}
      />
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#111827' }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '12px' }}>
          {value}
        </Typography>
      </Box>
      {copied && (
        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
          ✓ Copiado!
        </Typography>
      )}
    </Box>
  );
};

interface Section {
  id: string;
  title: string;
}

const sections: Section[] = [
  { id: 'cores', title: '🎨 Cores' },
  { id: 'tipografia', title: '🔤 Tipografia' },
  { id: 'botoes', title: '🔘 Botões' },
  { id: 'inputs', title: '📝 Inputs & Selects' },
  { id: 'cards', title: '📦 Cards' },
  { id: 'icones', title: '✨ Ícones' },
  { id: 'graficos', title: '📊 Gráficos' },
  { id: 'feedback', title: '💬 Feedback & Alerts' },
];

export default function DesignSystemShowcase() {
  const [activeSection, setActiveSection] = useState('cores');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Sidebar Navigation */}
      <Box
        sx={{
          width: 240,
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 3 }}>
          Design System
        </Typography>
        {sections.map((section) => (
          <Button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            sx={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              px: 2,
              py: 1.5,
              borderRadius: '8px',
              backgroundColor: activeSection === section.id ? '#f3f4f6' : 'transparent',
              color: activeSection === section.id ? '#111827' : '#6b7280',
              fontWeight: activeSection === section.id ? 600 : 400,
              '&:hover': {
                backgroundColor: '#f3f4f6',
              },
            }}
          >
            {section.title}
          </Button>
        ))}
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 4,
        }}
      >
        {/* Cores */}
        {activeSection === 'cores' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Box>
              <Typography variant="h2" sx={{ fontWeight: 700, color: '#111827', mb: 3 }}>
                🎨 Paleta de Cores
              </Typography>
              <Typography variant="body1" sx={{ color: '#6b7280', mb: 4 }}>
                Clique em qualquer cor para copiar o código hex
              </Typography>

              {/* Grays */}
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Neutras (Grays)
              </Typography>
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {Object.entries(colors.gray).map(([key, value]) => (
                  <Grid item xs={6} sm={4} md={3} key={key}>
                    <ColorSwatch label={`Gray ${key}`} value={value as string} />
                  </Grid>
                ))}
              </Grid>

              {/* Semânticas */}
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Semânticas
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4} md={3}>
                  <ColorSwatch label="Success" value={colors.success} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <ColorSwatch label="Error" value={colors.error} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <ColorSwatch label="Warning" value={colors.warning} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <ColorSwatch label="Info" value={colors.info} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <ColorSwatch label="Accent" value={colors.accent} />
                </Grid>
              </Grid>
            </Box>
          </Box>
        )}

        {/* Tipografia */}
        {activeSection === 'tipografia' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, color: '#111827' }}>
              🔤 Tipografia
            </Typography>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h1" sx={{ fontWeight: 700, color: '#111827', mb: 2 }}>
                H1 - Page Title (28px, Bold)
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h2" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                H2 - Section Title (24px, Semibold)
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                H3 - Subheading (20px, Semibold)
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                H4 - Small Heading (16px, Semibold)
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 400, color: '#374151', mb: 2 }}>
                Body Text - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. (14px, Regular)
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 400, color: '#6b7280', display: 'block' }}>
                Caption / Label Text - Used for helper text and small labels (12px, Regular)
              </Typography>
            </Paper>
          </Box>
        )}

        {/* Botões */}
        {activeSection === 'botoes' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, color: '#111827' }}>
              🔘 Botões
            </Typography>

            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Variantes Principais
              </Typography>
              <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <CustomButton variant="primary">Primary</CustomButton>
                <CustomButton variant="secondary">Secondary</CustomButton>
                <CustomButton variant="danger">Danger</CustomButton>
                <CustomButton variant="ghost">Ghost</CustomButton>
              </Paper>
            </Box>

            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Com Ícones
              </Typography>
              <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <CustomButton variant="primary">
                  <Plus size={18} style={{ marginRight: '6px' }} />
                  Criar
                </CustomButton>
                <CustomButton variant="secondary">
                  <Edit2 size={18} style={{ marginRight: '6px' }} />
                  Editar
                </CustomButton>
                <CustomButton variant="danger">
                  <Trash2 size={18} style={{ marginRight: '6px' }} />
                  Deletar
                </CustomButton>
              </Paper>
            </Box>

            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Tamanhos
              </Typography>
              <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <CustomButton variant="primary" size="small">
                  Small
                </CustomButton>
                <CustomButton variant="primary" size="medium">
                  Medium
                </CustomButton>
                <CustomButton variant="primary" size="large">
                  Large
                </CustomButton>
              </Paper>
            </Box>

            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Estados
              </Typography>
              <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <CustomButton variant="primary">Normal</CustomButton>
                <CustomButton variant="primary" disabled>
                  Disabled
                </CustomButton>
              </Paper>
            </Box>
          </Box>
        )}

        {/* Inputs */}
        {activeSection === 'inputs' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, color: '#111827' }}>
              📝 Inputs & Selects
            </Typography>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                TextField Padrão
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField fullWidth label="Descrição" placeholder="Ex: Compras no supermercado" size="small" />
                <TextField fullWidth label="Valor" type="number" placeholder="0,00" size="small" />
                <TextField
                  fullWidth
                  label="Tipo"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Senha segura"
                  size="small"
                  helperText="Mínimo 8 caracteres"
                />
              </Box>
            </Paper>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Select
              </Typography>
              <Select fullWidth size="small" defaultValue="conta">
                <MenuItem value="conta">Conta Corrente</MenuItem>
                <MenuItem value="poupanca">Poupança</MenuItem>
                <MenuItem value="carteira">Carteira</MenuItem>
              </Select>
            </Paper>
          </Box>
        )}

        {/* Cards */}
        {activeSection === 'cards' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, color: '#111827' }}>
              📦 Cards
            </Typography>

            <Grid container spacing={3}>
              {[
                { icon: <DollarSign size={24} />, title: 'Receitas', value: 'R$ 5.230,00', color: colors.success },
                { icon: <TrendingUp size={24} />, title: 'Despesas', value: 'R$ 2.890,00', color: colors.error },
                { icon: <Calendar size={24} />, title: 'Este Mês', value: '+R$ 2.340,00', color: colors.accent },
              ].map((item, idx) => (
                <Grid item xs={12} sm={6} md={4} key={idx}>
                  <Card
                    sx={{
                      p: 3,
                      backgroundColor: '#ffffff',
                      borderRadius: 2,
                      border: '1px solid #e5e7eb',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: '#d1d5db',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{ color: item.color }}>{item.icon}</Box>
                      <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>
                        {item.title}
                      </Typography>
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: item.color }}>
                      {item.value}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Ícones */}
        {activeSection === 'icones' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, color: '#111827' }}>
              ✨ Ícones Lucide
            </Typography>

            <Grid container spacing={2}>
              {icons.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={item.name}>
                    <Paper
                      sx={{
                        p: 2,
                        backgroundColor: '#ffffff',
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: '#d1d5db',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <IconComponent size={24} color={colors.accent} />
                      <Typography variant="caption" sx={{ textAlign: 'center', fontWeight: 500, color: '#374151' }}>
                        {item.name}
                      </Typography>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* Gráficos */}
        {activeSection === 'graficos' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, color: '#111827' }}>
              📊 Gráficos Recharts
            </Typography>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 3 }}>
                Receitas vs Despesas (BarChart)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff' }} />
                  <Legend />
                  <Bar dataKey="receita" fill={colors.success} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="despesa" fill={colors.error} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 3 }}>
                Evolução (LineChart)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="receita" stroke={colors.success} strokeWidth={2} dot={{ fill: colors.success, r: 4 }} />
                  <Line type="monotone" dataKey="despesa" stroke={colors.error} strokeWidth={2} dot={{ fill: colors.error, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            <Paper sx={{ p: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 3 }}>
                Distribuição (PieChart)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} ${value}%`} outerRadius={80}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Box>
        )}

        {/* Feedback & Alerts */}
        {activeSection === 'feedback' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, color: '#111827' }}>
              💬 Feedback & Alerts
            </Typography>

            <Alert severity="success" sx={{ borderRadius: 2 }}>
              ✓ Operação realizada com sucesso! A transação foi adicionada.
            </Alert>

            <Alert severity="error" sx={{ borderRadius: 2 }}>
              ✗ Erro ao processar. Verifique os dados e tente novamente.
            </Alert>

            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              ⚠ Aviso: Você está próximo do limite de crédito disponível.
            </Alert>

            <Alert severity="info" sx={{ borderRadius: 2 }}>
              ℹ Informação: Sua fatura será fechada no dia 5 do próximo mês.
            </Alert>

            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Chips
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="Receita" icon={<Check size={16} />} color="success" variant="outlined" />
                <Chip label="Despesa" icon={<AlertCircle size={16} />} color="error" variant="outlined" />
                <Chip label="Parcelado" variant="outlined" />
                <Chip label="Recorrente" variant="outlined" />
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
