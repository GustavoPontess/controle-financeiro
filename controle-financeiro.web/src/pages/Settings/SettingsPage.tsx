import { Box, Typography, Card, CardContent } from "@mui/material"

export default function SettingsPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography fontSize={22} fontWeight={800} color="text.primary" mb={0.5}>
          Configurações
        </Typography>
        <Typography fontSize={13} color="text.secondary">
          Gerencie as preferências da sua conta e visualize informações sobre seus dados.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 2 }}>
        <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "16px", opacity: 0.5 }}>
          <CardContent sx={{ p: 2.5, textAlign: "center" }}>
            <Typography fontSize={14} color="text.secondary">
              Mais configurações em breve
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
