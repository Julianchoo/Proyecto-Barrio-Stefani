"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import type { EstadoLead } from "@/lib/schema";

type LeadRow = {
  id: number;
  nombre: string;
  telefono: string;
  email: string;
  mensaje: string | null;
  estado: EstadoLead;
  notas: string | null;
  asignadoA: string | null;
  asignadoNombre: string | null;
  dniCuit: string | null;
  domicilio: string | null;
  createdAt: string;
};

type UsuarioRow = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const estadoColors: Record<EstadoLead, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  asignado: "bg-purple-100 text-purple-700",
  a_contactar: "bg-orange-100 text-orange-700",
  contactado: "bg-yellow-100 text-yellow-700",
  sin_respuesta: "bg-red-100 text-red-700",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-gray-100 text-gray-700",
};

const estadoLabels: Record<EstadoLead, string> = {
  nuevo: "Nuevo",
  asignado: "Asignado",
  a_contactar: "A contactar",
  contactado: "Contactado",
  sin_respuesta: "Sin respuesta",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

export default function LeadsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkEstado, setBulkEstado] = useState<EstadoLead | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const lastCheckedIndexRef = useRef<number | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [editLead, setEditLead] = useState<LeadRow | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", telefono: "", email: "", dniCuit: "", domicilio: "", notas: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ nombre: "", telefono: "", email: "", mensaje: "", dniCuit: "", domicilio: "", notas: "" });
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/crm/usuarios")
        .then((r) => r.json())
        .then(setUsuarios)
        .catch(() => {});
    }
  }, [isAdmin]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterEstado !== "all") params.set("estado", filterEstado);
    const res = await fetch(`/api/crm/leads?${params}`);
    const data = await res.json();
    setLeads(data);
    setSelected(new Set());
    lastCheckedIndexRef.current = null;
    setLoading(false);
  }, [filterEstado]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleEstadoChange = async (id: number, estado: EstadoLead) => {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, estado } : l)));
    const res = await fetch(`/api/crm/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (!res.ok) {
      setLeads(prev);
      toast.error("No se pudo actualizar el estado");
    }
  };

  const handleAsignacionChange = async (id: number, userId: string | null) => {
    const prev = leads;
    const usuarioNombre = userId
      ? (usuarios.find((u) => u.id === userId)?.name ?? null)
      : null;
    setLeads((ls) =>
      ls.map((l) =>
        l.id === id
          ? { ...l, asignadoA: userId, asignadoNombre: usuarioNombre }
          : l
      )
    );
    const res = await fetch(`/api/crm/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignadoA: userId }),
    });
    if (!res.ok) {
      setLeads(prev);
      toast.error("No se pudo asignar el lead");
    }
  };

  const handleCheckbox = (id: number, index: number, shiftKey: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastCheckedIndexRef.current !== null) {
        const from = Math.min(lastCheckedIndexRef.current, index);
        const to = Math.max(lastCheckedIndexRef.current, index);
        const isSelecting = !prev.has(id);
        for (let i = from; i <= to; i++) {
          const lead = leads[i];
          if (!lead) continue;
          if (isSelecting) next.add(lead.id);
          else next.delete(lead.id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    lastCheckedIndexRef.current = index;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelected(new Set(leads.map((l) => l.id)));
    } else {
      setSelected(new Set());
    }
    lastCheckedIndexRef.current = null;
  };

  const handleBulkUpdate = async () => {
    if (!bulkEstado || selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    const prev = leads;
    setLeads((ls) =>
      ls.map((l) => (selected.has(l.id) ? { ...l, estado: bulkEstado as EstadoLead } : l))
    );
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/crm/leads/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: bulkEstado }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setLeads(prev);
        toast.error(`${failed} actualizacion(es) fallaron`);
      } else {
        toast.success(`${ids.length} lead(s) actualizados`);
        setSelected(new Set());
        setBulkEstado("");
      }
    } catch {
      setLeads(prev);
      toast.error("Error al actualizar");
    } finally {
      setBulkLoading(false);
    }
  };

  function openEditDialog(lead: LeadRow) {
    setEditLead(lead);
    setEditForm({
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      dniCuit: lead.dniCuit ?? "",
      domicilio: lead.domicilio ?? "",
      notas: lead.notas ?? "",
    });
  }

  async function handleEditSave() {
    if (!editLead) return;
    setEditSaving(true);
    // Only send changed fields
    const changed: Record<string, string | null> = {};
    if (editForm.nombre !== editLead.nombre) changed.nombre = editForm.nombre;
    if (editForm.telefono !== editLead.telefono) changed.telefono = editForm.telefono;
    if (editForm.email !== editLead.email) changed.email = editForm.email;
    if (editForm.dniCuit !== (editLead.dniCuit ?? "")) changed.dniCuit = editForm.dniCuit || null;
    if (editForm.domicilio !== (editLead.domicilio ?? "")) changed.domicilio = editForm.domicilio || null;
    if (editForm.notas !== (editLead.notas ?? "")) changed.notas = editForm.notas || null;

    if (Object.keys(changed).length === 0) {
      setEditLead(null);
      setEditSaving(false);
      return;
    }

    const res = await fetch(`/api/crm/leads/${editLead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changed),
    });
    if (res.ok) {
      setLeads((ls) =>
        ls.map((l) =>
          l.id === editLead.id
            ? {
                ...l,
                nombre: editForm.nombre,
                telefono: editForm.telefono,
                email: editForm.email,
                dniCuit: editForm.dniCuit || null,
                domicilio: editForm.domicilio || null,
                notas: editForm.notas || null,
              }
            : l
        )
      );
      toast.success("Lead actualizado");
      setEditLead(null);
    } else {
      toast.error("Error al actualizar el lead");
    }
    setEditSaving(false);
  }

  async function handleCreateSave() {
    if (!createForm.nombre || !createForm.telefono || !createForm.email) return;
    setCreateSaving(true);
    const res = await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: createForm.nombre,
        telefono: createForm.telefono,
        email: createForm.email,
        mensaje: createForm.mensaje || null,
        dniCuit: createForm.dniCuit || null,
        domicilio: createForm.domicilio || null,
        notas: createForm.notas || null,
      }),
    });
    if (res.ok) {
      toast.success("Lead creado");
      setCreateOpen(false);
      setCreateForm({ nombre: "", telefono: "", email: "", mensaje: "", dniCuit: "", domicilio: "", notas: "" });
      fetchLeads();
    } else {
      toast.error("Error al crear el lead");
    }
    setCreateSaving(false);
  }

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const someSelected = selected.size > 0 && selected.size < leads.length;
  const colCount = isAdmin ? 9 : 8;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
        <p className="text-sm text-gray-500 mt-1">
          Consultas recibidas desde el formulario de contacto
        </p>
      </div>

      <div className="flex gap-3">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo lead
        </Button>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="nuevo">Nuevo</SelectItem>
            <SelectItem value="asignado">Asignado</SelectItem>
            <SelectItem value="a_contactar">A contactar</SelectItem>
            <SelectItem value="contactado">Contactado</SelectItem>
            <SelectItem value="sin_respuesta">Sin respuesta</SelectItem>
            <SelectItem value="closed_won">Closed won</SelectItem>
            <SelectItem value="closed_lost">Closed lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  aria-label="Seleccionar todos"
                  className="size-4 cursor-pointer accent-primary"
                />
              </TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Asignado a</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-16">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: colCount }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : leads.map((lead, index) => (
                  <TableRow
                    key={lead.id}
                    data-state={selected.has(lead.id) ? "selected" : undefined}
                    className={selected.has(lead.id) ? "bg-blue-50" : undefined}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={(e) => handleCheckbox(lead.id, index, (e.nativeEvent as MouseEvent).shiftKey)}
                        aria-label={`Seleccionar ${lead.nombre}`}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{lead.nombre}</TableCell>
                    <TableCell className="text-sm">{lead.telefono}</TableCell>
                    <TableCell className="text-sm">{lead.email}</TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                      {lead.mensaje ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={lead.estado}
                        onValueChange={(v) =>
                          handleEstadoChange(lead.id, v as EstadoLead)
                        }
                      >
                        <SelectTrigger className="h-7 w-36 text-xs border-0 p-0 shadow-none focus:ring-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[lead.estado]}`}
                          >
                            {estadoLabels[lead.estado]}
                          </span>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {(Object.keys(estadoLabels) as EstadoLead[]).map(
                            (e) => (
                              <SelectItem key={e} value={e}>
                                {estadoLabels[e]}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={lead.asignadoA ?? "__none__"}
                          onValueChange={(v) =>
                            handleAsignacionChange(lead.id, v === "__none__" ? null : v)
                          }
                        >
                          <SelectTrigger className="h-7 w-40 text-xs">
                            <SelectValue placeholder="Sin asignar" />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectItem value="__none__">
                              <span className="text-gray-400">— Sin asignar —</span>
                            </SelectItem>
                            {usuarios.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm text-gray-600">
                          {lead.asignadoNombre ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(lead.createdAt).toLocaleDateString("es-AR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(lead)}
                        aria-label={`Editar ${lead.nombre}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!loading && leads.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">
            No hay leads aún
          </p>
        )}
      </div>

      {/* Create lead dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-nombre">Nombre *</Label>
              <Input id="create-nombre" value={createForm.nombre} onChange={(e) => setCreateForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-telefono">Teléfono *</Label>
              <Input id="create-telefono" value={createForm.telefono} onChange={(e) => setCreateForm((f) => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-email">Email *</Label>
              <Input id="create-email" type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-dniCuit">DNI / CUIT</Label>
              <Input id="create-dniCuit" value={createForm.dniCuit} onChange={(e) => setCreateForm((f) => ({ ...f, dniCuit: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-domicilio">Domicilio</Label>
              <Input id="create-domicilio" value={createForm.domicilio} onChange={(e) => setCreateForm((f) => ({ ...f, domicilio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-mensaje">Mensaje</Label>
              <Textarea id="create-mensaje" rows={2} value={createForm.mensaje} onChange={(e) => setCreateForm((f) => ({ ...f, mensaje: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-notas">Notas</Label>
              <Textarea id="create-notas" rows={2} value={createForm.notas} onChange={(e) => setCreateForm((f) => ({ ...f, notas: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSave} disabled={createSaving || !createForm.nombre || !createForm.telefono || !createForm.email}>
              {createSaving ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit lead dialog */}
      <Dialog open={editLead !== null} onOpenChange={(open) => { if (!open) setEditLead(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-nombre">Nombre</Label>
              <Input id="edit-nombre" value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-telefono">Teléfono</Label>
              <Input id="edit-telefono" value={editForm.telefono} onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dniCuit">DNI / CUIT</Label>
              <Input id="edit-dniCuit" value={editForm.dniCuit} onChange={(e) => setEditForm((f) => ({ ...f, dniCuit: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-domicilio">Domicilio</Label>
              <Input id="edit-domicilio" value={editForm.domicilio} onChange={(e) => setEditForm((f) => ({ ...f, domicilio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notas">Notas</Label>
              <Textarea id="edit-notas" rows={3} value={editForm.notas} onChange={(e) => setEditForm((f) => ({ ...f, notas: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLead(null)}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-white px-5 py-3 shadow-xl">
          <span className="text-sm font-medium text-gray-700">
            {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          </span>
          <Select value={bulkEstado} onValueChange={(v) => setBulkEstado(v as EstadoLead)}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Cambiar estado..." />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(estadoLabels) as EstadoLead[]).map((e) => (
                <SelectItem key={e} value={e}>
                  {estadoLabels[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleBulkUpdate}
            disabled={!bulkEstado || bulkLoading}
          >
            {bulkLoading ? "Aplicando..." : "Aplicar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setSelected(new Set()); setBulkEstado(""); }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
