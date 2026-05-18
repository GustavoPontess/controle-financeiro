import { Typography, Paper } from "@mui/material"
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined"
import CustomButton from "../CustomButton"
import { tokens } from "../../theme/tokens"

type Props = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

/**
 * Estado vazio padrão para listas e seções sem dados.
 * Usa tokens de design do Monarch (Issue #60) para borderRadius e fontWeight.
 */
export default function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{ border: "1px dashed", borderColor: "divider", borderRadius: tokens.radius.lg, p: 4, textAlign: "center" }}
    >
      <InboxOutlinedIcon sx={{ fontSize: 32, color: "action.selected", mb: 1.5 }} />

      <Typography fontWeight={tokens.typography.fontWeight.bold} fontSize={tokens.typography.fontSize.sm} mb={0.5}>
        {title}
      </Typography>

      <Typography color="text.secondary" fontSize={tokens.typography.fontSize.xs} mb={2.5}>
        {description}
      </Typography>

      {actionLabel && (
        <CustomButton size="small" onClick={onAction}>
          {actionLabel}
        </CustomButton>
      )}
    </Paper>
  )
}
