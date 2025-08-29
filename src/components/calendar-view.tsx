"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  assignedTo: string;
  createdBy: string;
  organizationId: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdAt: number;
  updatedAt: number;
}

interface CalendarViewProps {
  organizationId: string;
  organizationMembers: Array<{
    _id: any;
    userId: string;
    role: "admin" | "member";
    joinedAt: number;
    user: {
      firstName: string;
      lastName: string;
      emailAddresses: Array<{ emailAddress: string }>;
    };
  }>;
}

export function CalendarView({ organizationId, organizationMembers }: CalendarViewProps) {
  const { user } = useUser();
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    assignedTo: user?.id || "",
  });
  const [editEvent, setEditEvent] = useState({
    title: "",
    description: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    assignedTo: "",
  });

  const events = useQuery(
    api.events.getOrganizationEvents,
    { organizationId: organizationId as any }
  );

  // Persisted user colors for this organization
  const storedColors = useQuery(
    api.userColors.getOrgUserColors,
    { organizationId: organizationId as any }
  );
  const upsertUserColor = useMutation(api.userColors.upsertUserColor);

  const createEvent = useMutation(api.events.createEvent);
  const updateEvent = useMutation(api.events.updateEvent);
  const deleteEvent = useMutation(api.events.deleteEvent);

  const calendarEvents = useMemo(() => {
    if (!events) return [];
    
    return events.map((event: CalendarEvent) => ({
      id: event._id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      resource: event,
    }));
  }, [events]);

  // Compute scheduling conflicts (overlaps) across ALL events (any assignee)
  const conflicts = useMemo(() => {
    if (!events) return [] as Array<{ a: CalendarEvent; b: CalendarEvent }>;

    const list = [...(events as CalendarEvent[])].sort((x, y) => x.startTime - y.startTime);
    const active: CalendarEvent[] = [];
    const pairs: Array<{ a: CalendarEvent; b: CalendarEvent }> = [];

    for (const curr of list) {
      // remove non-overlapping from active
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].endTime <= curr.startTime) active.splice(i, 1);
      }
      // any remaining active overlaps with curr
      for (const prev of active) {
        if (curr.startTime < prev.endTime) {
          pairs.push({ a: prev, b: curr });
        }
      }
      active.push(curr);
    }

    // Deduplicate unordered pairs
    const seen = new Set<string>();
    return pairs.filter(({ a, b }) => {
      const key = [a._id, b._id].sort().join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [events]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEvent.title.trim()) return;

    try {
      const startDateTime = new Date(`${newEvent.startDate}T${newEvent.startTime}`);
      const endDateTime = new Date(`${newEvent.endDate}T${newEvent.endTime}`);

      await createEvent({
        title: newEvent.title,
        description: newEvent.description || undefined,
        startTime: startDateTime.getTime(),
        endTime: endDateTime.getTime(),
        assignedTo: newEvent.assignedTo,
        createdBy: user.id,
        organizationId: organizationId as any,
      });

      setNewEvent({
        title: "",
        description: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        assignedTo: user.id,
      });
      setShowCreateDialog(false);
    } catch (error) {
      console.error("Error creating event:", error);
    }
  };

  const handleSelectEvent = (event: any) => {
    const calendarEvent = event.resource as CalendarEvent;
    setSelectedEvent(calendarEvent);
  };

  const currentUserRole = useMemo(() => {
    const currentMember = organizationMembers.find(member => member.userId === user?.id);
    return currentMember?.role || "member";
  }, [organizationMembers, user?.id]);

  const canEditEvent = (event: CalendarEvent) => {
    if (currentUserRole === "admin") return true;
    return event.assignedTo === user?.id || event.createdBy === user?.id;
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEditEvent({
      title: event.title,
      description: event.description || "",
      startDate: moment(event.startTime).format('YYYY-MM-DD'),
      startTime: moment(event.startTime).format('HH:mm'),
      endDate: moment(event.endTime).format('YYYY-MM-DD'),
      endTime: moment(event.endTime).format('HH:mm'),
      assignedTo: event.assignedTo,
    });
    setSelectedEvent(null);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      const startDateTime = new Date(`${editEvent.startDate}T${editEvent.startTime}`);
      const endDateTime = new Date(`${editEvent.endDate}T${editEvent.endTime}`);

      await updateEvent({
        id: editingEvent._id as any,
        title: editEvent.title,
        description: editEvent.description || undefined,
        startTime: startDateTime.getTime(),
        endTime: endDateTime.getTime(),
        assignedTo: editEvent.assignedTo,
      });

      setEditingEvent(null);
    } catch (error) {
      console.error("Error updating event:", error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent({ id: eventId as any });
      setSelectedEvent(null);
      setEditingEvent(null);
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    if (currentUserRole === "member" && newEvent.assignedTo !== user?.id) {
      // Members can only create events for themselves
      setNewEvent(prev => ({ ...prev, assignedTo: user?.id || "" }));
    }
    
    setNewEvent(prev => ({
      ...prev,
      startDate: moment(start).format('YYYY-MM-DD'),
      startTime: moment(start).format('HH:mm'),
      endDate: moment(end).format('YYYY-MM-DD'),
      endTime: moment(end).format('HH:mm'),
    }));
    setShowCreateDialog(true);
  };

  const getAssignedUserName = (userId: string) => {
    const member = organizationMembers.find(m => m.userId === userId);
    if (member?.user?.firstName && member?.user?.lastName) {
      return `${member.user.firstName} ${member.user.lastName}`;
    }
    return `User ${userId.slice(-4)}`;
  };

  // Shared palette for defaults
  const palette = useMemo(
    () => [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#14b8a6', // teal
      '#f97316', // orange
      '#22c55e', // emerald
    ],
    []
  );

  // Build a map of userId -> color from stored colors
  const colorsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (storedColors) {
      for (const row of storedColors as Array<{ userId: string; color: string }>) {
        map.set(row.userId, row.color);
      }
    }
    return map;
  }, [storedColors]);

  // Initialize missing colors by assigning defaults and persisting them
  useEffect(() => {
    if (!organizationMembers?.length) return;
    if (storedColors === undefined) return; // still loading

    const used = new Set<string>(Array.from(colorsMap.values()));
    const pickColor = (startIdx: number) => {
      for (let i = 0; i < palette.length; i++) {
        const color = palette[(startIdx + i) % palette.length];
        if (!used.has(color)) return color;
      }
      // fallback cycles
      return palette[startIdx % palette.length];
    };

    const missing = organizationMembers.filter(m => !colorsMap.has(m.userId));
    if (missing.length === 0) return;

    (async () => {
      const promises: Promise<any>[] = [];
      for (let i = 0; i < missing.length; i++) {
        const member = missing[i];
        const idx = Math.max(0, organizationMembers.findIndex(mm => mm.userId === member.userId));
        const color = pickColor(idx);
        used.add(color);
        promises.push(
          upsertUserColor({
            organizationId: organizationId as any,
            userId: member.userId,
            color,
          })
        );
      }
      try { await Promise.all(promises); } catch (e) { console.error("Failed to upsert user colors", e); }
    })();
  }, [organizationMembers, storedColors, colorsMap, palette, organizationId, upsertUserColor]);

  // Get color for a user (from stored map; fallback to palette by index)
  const getUserColor = (userId: string) => {
    const stored = colorsMap.get(userId);
    if (stored) return stored;
    const idx = Math.max(0, organizationMembers.findIndex(m => m.userId === userId));
    return palette[idx % palette.length];
  };


  const availableAssignees = currentUserRole === "admin" 
    ? organizationMembers 
    : organizationMembers.filter(m => m.userId === user?.id);

  return (
    <div className="space-y-6">
      {/* Conflicts Summary Tile */}
      <Card className={conflicts.length ? "border-red-300" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Scheduling Conflicts</span>
            <Badge className={conflicts.length ? "bg-red-600" : "bg-green-600"}>
              {conflicts.length ? `${conflicts.length}` : "0"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conflicts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conflicts detected.</p>
          ) : (
            <div className="space-y-3">
              {conflicts.slice(0, 5).map((c, idx) => {
                const aName = getAssignedUserName(c.a.assignedTo);
                const bName = getAssignedUserName(c.b.assignedTo);
                return (
                  <div key={idx} className="text-sm p-3 rounded-md border bg-white">
                    <div className="font-medium">{aName} ↔ {bName}</div>
                    <div className="mt-1 text-muted-foreground">
                      <div>
                        {moment(c.a.startTime).format('MMM DD, HH:mm')} - {moment(c.a.endTime).format('HH:mm')}: {c.a.title}
                      </div>
                      <div>
                        {moment(c.b.startTime).format('MMM DD, HH:mm')} - {moment(c.b.endTime).format('HH:mm')}: {c.b.title}
                      </div>
                    </div>
                  </div>
                );
              })}
              {conflicts.length > 5 && (
                <div className="text-xs text-muted-foreground">
                  +{conflicts.length - 5} more conflict{conflicts.length - 5 === 1 ? "" : "s"}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <CalendarIcon className="h-8 w-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold">Project Schedule</h2>
            <p className="text-muted-foreground">
              {currentUserRole === "admin" ? "Manage team schedules and assignments" : "View your assigned events"}
            </p>
          </div>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="h-[100vh] sm:h-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={newEvent.startDate}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={newEvent.endDate}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, endDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Assign To</label>
                <Select 
                  value={newEvent.assignedTo} 
                  onValueChange={(value) => setNewEvent(prev => ({ ...prev, assignedTo: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssignees.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.user.firstName} {member.user.lastName} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button type="submit" size="lg" className="w-full">Create Event</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  size="lg"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-6">
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              popup
              views={[Views.MONTH, Views.WEEK, Views.DAY]}
              step={30}
              showMultiDayTimes
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: getUserColor((event.resource as CalendarEvent).assignedTo),
                },
              })}
              components={{
                toolbar: (props) => (
                  <div className="flex items-center justify-between mb-4 p-4 bg-white rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => props.onNavigate('PREV')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => props.onNavigate('TODAY')}
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => props.onNavigate('NEXT')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <h2 className="text-lg font-semibold">
                      {props.label}
                    </h2>
                    
                    <div className="flex gap-1">
                      {[Views.MONTH, Views.WEEK, Views.DAY].map((viewName) => (
                        <Button
                          key={viewName}
                          variant={props.view === viewName ? "default" : "outline"}
                          size="sm"
                          onClick={() => props.onView(viewName)}
                        >
                          {viewName.charAt(0).toUpperCase() + viewName.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ),
              }}
            />
          </div>
        </CardContent>
      </Card>

      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="h-[100vh] sm:h-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedEvent.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p>{selectedEvent.description || "No description"}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Start</p>
                  <p>{moment(selectedEvent.startTime).format('MMM DD, YYYY HH:mm')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End</p>
                  <p>{moment(selectedEvent.endTime).format('MMM DD, YYYY HH:mm')}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Assigned To</p>
                <p>{organizationMembers.find(m => m.userId === selectedEvent.assignedTo)?.user?.firstName} {organizationMembers.find(m => m.userId === selectedEvent.assignedTo)?.user?.lastName}</p>
              </div>

              <div>
                {/* Status removed from UI */}
              </div>

              {canEditEvent(selectedEvent) && (
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEditEvent(selectedEvent)}
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteEvent(selectedEvent._id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Event Dialog */}
      {editingEvent && (
        <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
          <DialogContent className="h-[100vh] sm:h-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editEvent.title}
                  onChange={(e) => setEditEvent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editEvent.description}
                  onChange={(e) => setEditEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={editEvent.startDate}
                    onChange={(e) => setEditEvent(prev => ({ ...prev, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    type="time"
                    value={editEvent.startTime}
                    onChange={(e) => setEditEvent(prev => ({ ...prev, startTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={editEvent.endDate}
                    onChange={(e) => setEditEvent(prev => ({ ...prev, endDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input
                    type="time"
                    value={editEvent.endTime}
                    onChange={(e) => setEditEvent(prev => ({ ...prev, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Assign To</label>
                <Select 
                  value={editEvent.assignedTo} 
                  onValueChange={(value) => setEditEvent(prev => ({ ...prev, assignedTo: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssignees.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.user.firstName} {member.user.lastName} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status editing removed */}

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button type="submit" size="lg" className="w-full">Update Event</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingEvent(null)}
                  size="lg"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
