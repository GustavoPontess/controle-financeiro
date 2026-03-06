import { useEffect, useState } from "react"
import { Box, Typography, Button, Paper } from "@mui/material"
import { useOutletContext } from "react-router-dom"

import type { Person } from "../../types/Person"

import { getPeople, deletePerson } from "../../services/personService"

import AddRoundedIcon from "@mui/icons-material/AddRounded"

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

  const { notify, refreshTransactionRequirements } =
    useOutletContext<OutletContextType>()

  const [people, setPeople] = useState<Person[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)

  const loadPeople = async () => {
    const data = await getPeople()
    setPeople(data)
  }

  useEffect(() => {

    const fetchPeople = async () => {
      const data = await getPeople()
      setPeople(data)
    }

    fetchPeople()

  }, [])

  const handleDelete = async (id: string) => {

    if (!confirm("Deseja realmente excluir esta pessoa?")) return

    await deletePerson(id)

    notify({
      open: true,
      message: "Pessoa removida com sucesso",
      severity: "success"
    })

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

    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >

        <Box>

          <Typography variant="h5" fontWeight={600}>
            Pessoas Cadastradas
          </Typography>

          <Typography color="text.secondary">
            Gerencie os participantes do sistema e acompanhe suas atividades
          </Typography>

        </Box>

        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => {
            setEditingPerson(null)
            setOpenDialog(true)
          }}
          sx={{
            backgroundColor: "#111827",
            borderRadius: "10px",
            "&:hover": { backgroundColor: "#1f2937" }
          }}
        >
          Adicionar Pessoa
        </Button>

      </Box>

      <Paper
        elevation={0}
        sx={{
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          p: 3
        }}
      >

        <Typography fontWeight={600} mb={2}>
          Resumo Geral
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 3
          }}
        >

          <Box>
            <Typography color="text.secondary" fontSize={13}>
              Total de Pessoas
            </Typography>

            <Typography fontWeight={600} fontSize={20}>
              {people.length}
            </Typography>
          </Box>

          <Box>
            <Typography color="text.secondary" fontSize={13}>
              Pessoas Adultas
            </Typography>

            <Typography fontWeight={600} fontSize={20}>
              {people.filter(p => p.idade >= 18).length}
            </Typography>
          </Box>

          <Box>
            <Typography color="text.secondary" fontSize={13}>
              Menores de Idade
            </Typography>

            <Typography fontWeight={600} fontSize={20}>
              {people.filter(p => p.idade < 18).length}
            </Typography>
          </Box>

        </Box>

      </Paper>

      {people.length === 0 ? (

        <EmptyState
          title="Nenhuma pessoa cadastrada"
          description="Adicione a primeira pessoa para começar a registrar transações."
          actionLabel="Adicionar Pessoa"
          onAction={() => setOpenDialog(true)}
        />

      ) : (

        <PeopleTable
          people={people}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

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