import { Typography, Button, Paper } from "@mui/material"
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined"

type Props = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: Props) {

  return (

    <Paper
      elevation={0}
      sx={{
        border: "1px dashed #e5e7eb",
        borderRadius: "12px",
        p: 6,
        textAlign: "center"
      }}
    >

      <InboxOutlinedIcon
        sx={{
          fontSize: 48,
          color: "#9ca3af",
          mb: 2
        }}
      />

      <Typography fontWeight={600} mb={1}>
        {title}
      </Typography>

      <Typography color="text.secondary" mb={3}>
        {description}
      </Typography>

      {actionLabel && (

        <Button
          variant="contained"
          onClick={onAction}
          sx={{
            backgroundColor: "#111827",
            "&:hover": { backgroundColor: "#1f2937" }
          }}
        >
          {actionLabel}
        </Button>

      )}

    </Paper>

  )

}