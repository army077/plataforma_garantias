// src/pages/MainPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Paper,
  CircularProgress,
} from "@mui/material";
import DialpadIcon from "@mui/icons-material/Dialpad";
import SendIcon from "@mui/icons-material/Send";

const MainPage = () => {
  const [query, setQuery] = useState("");
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Debug opcional
    // console.log("📌 selectedTicket actualizado:", selectedTicket);
  }, [selectedTicket]);

  const getZohoId = (t) => t?.zohoId ?? t?.id ?? t?.ticketId;

  const fetchTickets = async (ticketNumber) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://desarrollotecnologicoar.com/api8/search-ticket/${encodeURIComponent(
          ticketNumber
        )}`
      );
      if (!response.ok) throw new Error("No se encontraron tickets");
      const data = await response.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      setFilteredTickets(list);
      setError(list.length ? "" : "No se encontraron tickets");
      return list;
    } catch (err) {
      setFilteredTickets([]);
      setError("No se encontraron tickets");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    setError("");
    setSelectedTicket(null);

    if (value.length > 3) {
      await fetchTickets(value);
    } else {
      setFilteredTickets([]);
    }
  };

  const handleSelectTicket = (ticket) => {
    setQuery(ticket.ticketNumber || "");
    setSelectedTicket(ticket);
    // Limpia la lista para no estorbar visualmente
    setFilteredTickets([]);
  };

  const handleSearch = async () => {
    if (!query) {
      setError("Ingresa un número de ticket");
      return;
    }
    const results = await fetchTickets(query);
    if (results.length === 1) {
      const zid = getZohoId(results[0]);
      if (zid) navigate(`/create/${zid}`);
    }
  };

  const goWithSelected = () => {
    if (!selectedTicket) return;
    const zid = getZohoId(selectedTicket);
    if (zid) navigate(`/create/${zid}`);
    else setError("El ticket no tiene un identificador válido.");
  };

  return (
    <Box
      sx={{
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        gap: 2,
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: "bold", mb: 1, textAlign: "center" }}>
        Solicita piezas de un ticket
      </Typography>

      {/* Contenedor del input y botón */}
      <Box
        sx={{
          backgroundColor: "#fff",
          p: 2,
          borderRadius: 2,
          boxShadow: "0px 4px 10px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          width: "80%",
          maxWidth: 700,
          gap: 2,
        }}
      >
        <DialpadIcon sx={{ color: "gray" }} />
        <TextField
          variant="standard"
          placeholder="Ingresa el número de ticket"
          fullWidth
          value={query}
          onChange={handleInputChange}
          InputProps={{ disableUnderline: true }}
        />

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <Button
            variant="contained"
            sx={{
              backgroundColor: "black",
              color: "white",
              borderRadius: 2,
              px: 2.5,
              py: 1,
              fontWeight: "bold",
              "&:hover": { backgroundColor: "#333" },
              minWidth: 48,
            }}
            onClick={() => {
              if (selectedTicket) {
                goWithSelected();
              } else {
                handleSearch();
              }
            }}
            aria-label="Buscar o continuar"
          >
            <SendIcon />
          </Button>
        )}
      </Box>

      {/* Lista de resultados */}
      {filteredTickets.length > 0 && (
        <Paper
          sx={{
            backgroundColor: "white",
            boxShadow: "0px 4px 6px rgba(0,0,0,0.15)",
            borderRadius: 2,
            zIndex: 20,
            maxHeight: 280,
            overflowY: "auto",
            width: "90%",
            maxWidth: 700,
          }}
        >
          <List dense>
            {filteredTickets.map((ticket) => (
              <ListItem
                key={ticket.ticketNumber ?? getZohoId(ticket) ?? Math.random()}
                disablePadding
              >
                <ListItemButton onClick={() => handleSelectTicket(ticket)}>
                  <ListItemText
                    primary={`#${ticket.ticketNumber ?? "s/n"} - ${ticket.subject ?? "Sin asunto"}`}
                    secondary={`Estado: ${ticket.status ?? "Desconocido"}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Error */}
      {!!error && (
        <Typography variant="body1" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}

      {/* Resumen del ticket seleccionado */}
      {selectedTicket && (
        <Box
          sx={{
            mt: 1,
            backgroundColor: "white",
            p: 2,
            borderRadius: 2,
            boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
            maxWidth: 700,
            width: "90%",
            textAlign: "left",
            color: "black",
          }}
        >
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Ticket seleccionado
          </Typography>
          <Typography variant="body1">
            <strong>Número de Ticket:</strong> {selectedTicket.ticketNumber ?? "No disponible"}
          </Typography>
          <Typography variant="body1">
            <strong>Asunto:</strong> {selectedTicket.subject ?? "No disponible"}
          </Typography>
          <Typography variant="body1">
            <strong>Estado:</strong> {selectedTicket.status ?? "No disponible"}
          </Typography>
          <Typography variant="body1">
            <strong>Cliente:</strong>{" "}
            {`${selectedTicket.contact?.account?.accountName ?? ""} ${selectedTicket.contact?.firstName ?? ""} ${selectedTicket.contact?.lastName ?? ""}`.trim() ||
              "No disponible"}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MainPage;
