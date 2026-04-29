import { useEffect, useState } from "react"
import { Box, Typography } from "@mui/material"
import { useOutletContext } from "react-router-dom"
import type { Person } from "../../types/Person"
import { getPeople, deletePerson } from "../../services/personService"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import CustomButton from "../../components/CustomButton"
import PeopleTable from "../../components/People/PeopleTable/PeopleTable"
import NewPersonDialog from "../../components/People/NewPersonDialog/NewPersonDialog"
import EmptyState from "../../components/EmptyState/EmptyState"

type Notification = {
  open: boolean
  message: string
  severity: "success" | "error"
}

type OutletContextType = {
  notify: React.Dispatch<React.SetStateAction<Notification>>
  refreshTransactionRequirements: () => Promise<void>
}

export default function PeoplePage() {
  const { notify, refreshTransactionRequirements } = useOutletContext<OutletContextType>()
  const [people, setPeople] = useState<Person[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)

  const loadPeople = async () => {
    const data = await getPeople()
    setPeople(data)
  }

  useEffect(() => {
    (async () => {
      await loadPeople()
    })()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta pessoa?")) return
    await deletePerson(id)
    notify({ open: true, message: "Pessoa removida com sucesso", severity: "success" })
    await loadPeople()
    await refreshTransactionRequirements()
  }

  const handleEdit = (person: Person) => {
    setEditingPerson(person)
    setOpenDialog(true)
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
    setEditingPerson(null)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography fontSize={14} fontWeight={600} color="#111827">
          Pessoas
        </Typography>
        <CustomButton
          size="small"
          startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => { setEditingPerson(null); setOpenDialog(true) }}
        >
          Adicionar Pessoa
        </CustomButton>
      </Box>

      {people.length === 0 ? (
        <EmptyState
          title="Nenhuma pessoa cadastrada"
          description="Adicione a primeira pessoa para começar a registrar transações."
          actionLabel="Adicionar Pessoa"
          onAction={() => setOpenDialog(true)}
        />
      ) : (
        <PeopleTable people={people} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <NewPersonDialog
        open={openDialog}
        editingPerson={editingPerson}
        onClose={handleCloseDialog}
        onCreated={async () => {
          await loadPeople()
          await refreshTransactionRequirements()
        }}
        notify={notify}
      />
    </Box>
  )
}
