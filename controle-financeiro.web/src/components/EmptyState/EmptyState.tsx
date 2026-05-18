import { Typography, Paper } from "@mui/material"
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined"
import CustomButton from "../CustomButton"

type Props = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{ border: "1px dashed", borderColor: "divider", borderRadius: "12px", p: 4, textAlign: "center" }}
    >
      <InboxOutlinedIcon sx={{ fontSize: 32, color: "action.selected", mb: 1.5 }} />

      <Typography fontWeight={600} fontSize={13} mb={0.5}>
        {title}
      </Typography>

      <Typography color="text.secondary" fontSize={12} mb={2.5}>
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
