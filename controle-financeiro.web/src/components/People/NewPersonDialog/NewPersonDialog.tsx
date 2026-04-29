import { Dialog, DialogTitle, DialogContent, IconButton, Box } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"

import PersonForm from "../PersonForm/PersonForm"

import { createPerson, updatePerson } from "../../../services/personService"

import type { Person } from "../../../types/Person"

type Notification = {
  open: boolean
  message: string
  severity: "success" | "error"
}

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
  notify: React.Dispatch<React.SetStateAction<Notification>>
  editingPerson?: Person | null
}

export default function NewPersonDialog({
  open,
  onClose,
  onCreated,
  notify,
  editingPerson
}: Props) {

  const handleSubmit = async (person: Omit<Person, "id" | "idade">) => {

    try {

      if (editingPerson) {

        await updatePerson(editingPerson.id, person)

        notify({
          open: true,
          message: "Pessoa atualizada com sucesso",
          severity: "success"
        })

      } else {

        await createPerson(person)

        notify({
          open: true,
          message: "Pessoa criada com sucesso",
          severity: "success"
        })

      }

      await onCreated()

      onClose()

    } catch (error) {

      console.error(error)

      notify({
        open: true,
        message: editingPerson
          ? "Erro ao atualizar pessoa"
          : "Erro ao criar pessoa",
        severity: "error"
      })

    }

  }

  return (

    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>

      <DialogTitle sx={{ p: 0 }}>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 2,
            fontWeight: 600,
            fontSize: 16
          }}
        >

          {editingPerson ? "Editar Pessoa" : "Nova Pessoa"}

          <IconButton
            onClick={onClose}
            sx={{
              width: 24,
              height: 24,
              color: "#9ca3af",
              "&:hover": { backgroundColor: "#f3f4f6", color: "#374151" }
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>

        </Box>

      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>

        <PersonForm
          editingPerson={editingPerson}
          onSubmit={handleSubmit}
          onCancelEdit={onClose}
        />

      </DialogContent>

    </Dialog>

  )

}