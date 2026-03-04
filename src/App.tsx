/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  BookOpen, 
  Network, 
  Sparkles, 
  ChevronRight, 
  Clock,
  Tag,
  Trash2,
  Save,
  LayoutGrid,
  Share2
} from 'lucide-react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Handle,
  Position,
  type Node, 
  type Edge, 
  type Connection,
  MarkerType,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Custom Node Component for Inline Editing
const NoteNode = ({ data, id }: { data: any, id: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.label);

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const onBlur = () => {
    setIsEditing(false);
    if (title !== data.label) {
      data.onTitleUpdate(id, title);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onBlur();
    }
  };

  return (
    <div 
      onDoubleClick={onDoubleClick}
      className="bg-white text-[#1a1a1a] border border-black/10 rounded-xl p-3 text-xs font-medium w-[150px] text-center shadow-md hover:shadow-lg transition-all"
    >
      <Handle type="target" position={Position.Top} className="!bg-[#5a5a40]" />
      {isEditing ? (
        <input 
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className="w-full text-center border-none outline-none bg-black/5 rounded px-1"
        />
      ) : (
        <div className="truncate">{title}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-[#5a5a40]" />
    </div>
  );
};

const nodeTypes = {
  note: NoteNode,
};

interface Note {
  id: number;
  title: string;
  content: string;
  tags: string;
  created_at: string;
}

interface NoteConnection {
  id: number;
  source_id: number;
  target_id: number;
  relationship: string;
}

interface Analysis {
  summary: string;
  entities: string[];
  themes: string[];
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [connections, setConnections] = useState<NoteConnection[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  useEffect(() => {
    fetchNotes();
    fetchConnections();
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/connections');
      const data = await res.json();
      setConnections(data);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    }
  }, []);

  const handleCreateConnection = useCallback(async (targetId: number) => {
    if (!selectedNote) return;
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: selectedNote.id,
          target_id: targetId,
          relationship: 'related'
        }),
      });
      if (res.ok) {
        fetchConnections();
      }
    } catch (err) {
      console.error('Failed to create connection:', err);
    }
  }, [selectedNote, fetchConnections]);

  const handleSave = useCallback(async () => {
    if (!newNote.title || !newNote.content) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      });
      if (res.ok) {
        setIsCreating(false);
        setNewNote({ title: '', content: '', tags: '' });
        fetchNotes();
      }
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }, [newNote, fetchNotes]);

  const handleAnalyze = useCallback(async (content: string) => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleUpdateTitle = useCallback(async (id: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        fetchNotes();
      }
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  }, [fetchNotes]);

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Graph Data Mapping
  const initialNodes: Node[] = useMemo(() => notes.map((note, index) => ({
    id: note.id.toString(),
    type: 'note',
    data: { label: note.title, onTitleUpdate: handleUpdateTitle },
    position: { x: Math.cos(index) * 300 + 400, y: Math.sin(index) * 300 + 300 },
  })), [notes, handleUpdateTitle]);

  const initialEdges: Edge[] = useMemo(() => connections.map((conn) => ({
    id: `e-${conn.id}`,
    source: conn.source_id.toString(),
    target: conn.target_id.toString(),
    label: conn.relationship,
    animated: true,
    style: { stroke: '#5a5a40', strokeWidth: 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#5a5a40' }
  })), [connections]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    const note = notes.find(n => n.id.toString() === node.id);
    if (note) {
      setSelectedNote(note);
      setViewMode('list');
    }
  }, [notes]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#fdfcfb]">
      {/* Sidebar */}
      <aside className="w-80 border-r border-black/5 flex flex-col bg-white/50 backdrop-blur-xl">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-medium tracking-tight serif italic">Lumina</h1>
          </div>

          <div className="flex items-center gap-2 mb-8">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-black text-white' : 'bg-black/5 text-black/40 hover:bg-black/10'}`}
            >
              <LayoutGrid className="w-3 h-3" />
              Library
            </button>
            <button 
              onClick={() => setViewMode('graph')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === 'graph' ? 'bg-black text-white' : 'bg-black/5 text-black/40 hover:bg-black/10'}`}
            >
              <Network className="w-3 h-3" />
              Graph
            </button>
          </div>

          <button 
            onClick={() => { setIsCreating(true); setSelectedNote(null); setAnalysis(null); }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#5a5a40] text-white rounded-xl hover:bg-[#4a4a35] transition-all shadow-lg shadow-[#5a5a40]/10 mb-8"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Research</span>
          </button>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
            <input 
              type="text" 
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/5 border-none rounded-lg text-sm focus:ring-1 focus:ring-black/10 outline-none"
            />
          </div>

          <div className="space-y-1 overflow-y-auto flex-1">
            <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold mb-4 px-2">Recent Insights</p>
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => { setSelectedNote(note); setIsCreating(false); setAnalysis(null); }}
                className={`w-full text-left p-3 rounded-lg transition-all group ${
                  selectedNote?.id === note.id ? 'bg-black/5' : 'hover:bg-black/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium truncate pr-4">{note.title}</h3>
                  <ChevronRight className={`w-3 h-3 transition-transform ${selectedNote?.id === note.id ? 'rotate-90' : 'opacity-0 group-hover:opacity-100'}`} />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-black/40">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(note.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {viewMode === 'graph' ? (
            <motion.div 
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full bg-[#fdfcfb]"
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background color="#000" variant={BackgroundVariant.Dots} gap={20} size={1} opacity={0.05} />
                <Controls />
                <MiniMap nodeStrokeWidth={3} zoomable pannable />
              </ReactFlow>
              <div className="absolute top-8 left-8 z-10">
                <h2 className="text-3xl font-light serif italic">Knowledge Graph</h2>
                <p className="text-xs text-black/40 mt-2">Interactive map of your research nodes and their relationships.</p>
              </div>
            </motion.div>
          ) : isCreating ? (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto py-20 px-8"
            >
              <input 
                type="text"
                placeholder="Research Title"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                className="w-full text-5xl font-light serif italic border-none outline-none bg-transparent mb-8 placeholder:text-black/10"
              />
              <textarea 
                placeholder="Begin your inquiry..."
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                className="w-full h-[400px] text-lg leading-relaxed border-none outline-none bg-transparent resize-none placeholder:text-black/10"
              />
              <div className="flex items-center gap-4 mt-8 pt-8 border-t border-black/5">
                <button 
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Save to Library
                </button>
                <button 
                  onClick={() => setIsCreating(false)}
                  className="px-6 py-2 text-sm font-medium text-black/40 hover:text-black transition-all"
                >
                  Discard
                </button>
              </div>
            </motion.div>
          ) : selectedNote ? (
            <motion.div 
              key={selectedNote.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto py-20 px-8 flex gap-12"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-6 text-[10px] uppercase tracking-widest text-black/40 font-semibold">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(selectedNote.created_at).toLocaleDateString()}</span>
                </div>
                <h2 className="text-6xl font-light serif italic mb-12 leading-tight">{selectedNote.title}</h2>
                <div className="prose prose-lg max-w-none text-black/80 leading-relaxed font-light whitespace-pre-wrap">
                  {selectedNote.content}
                </div>
              </div>

              {/* AI Insight Panel */}
              <div className="w-72 shrink-0">
                <div className="sticky top-20 space-y-8">
                  <div className="p-6 bg-white border border-black/5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-black/40">AI Analysis</h4>
                      <Sparkles className="w-4 h-4 text-[#5a5a40]" />
                    </div>
                    
                    {!analysis && !isAnalyzing && (
                      <button 
                        onClick={() => handleAnalyze(selectedNote.content)}
                        className="w-full py-2 text-xs font-medium border border-black/10 rounded-lg hover:bg-black hover:text-white transition-all"
                      >
                        Analyze Content
                      </button>
                    )}

                    {isAnalyzing && (
                      <div className="flex items-center gap-3 py-4">
                        <div className="w-2 h-2 bg-[#5a5a40] rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-[#5a5a40] rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-2 h-2 bg-[#5a5a40] rounded-full animate-bounce [animation-delay:0.4s]" />
                        <span className="text-xs text-black/40 italic">Synthesizing...</span>
                      </div>
                    )}

                    {analysis && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-black/20 mb-2">Summary</p>
                          <p className="text-xs leading-relaxed text-black/70">{analysis.summary}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-black/20 mb-2">Key Themes</p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.themes.map((theme, i) => (
                              <span key={i} className="px-2 py-1 bg-black/5 rounded text-[10px] font-medium">{theme}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-black/20 mb-2">Entities</p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.entities.map((entity, i) => (
                              <span key={i} className="px-2 py-1 border border-black/5 rounded text-[10px] italic">{entity}</span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="p-6 bg-[#5a5a40]/5 border border-[#5a5a40]/10 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                      <Network className="w-4 h-4 text-[#5a5a40]" />
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#5a5a40]">Connections</h4>
                    </div>
                    
                    <div className="space-y-3">
                      {connections.filter(c => c.source_id === selectedNote.id || c.target_id === selectedNote.id).length > 0 ? (
                        <div className="space-y-2">
                          {connections.filter(c => c.source_id === selectedNote.id || c.target_id === selectedNote.id).map(c => {
                            const otherId = c.source_id === selectedNote.id ? c.target_id : c.source_id;
                            const otherNote = notes.find(n => n.id === otherId);
                            return (
                              <div key={c.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-black/5">
                                <span className="text-[10px] font-medium truncate max-w-[120px]">{otherNote?.title}</span>
                                <span className="text-[8px] uppercase tracking-tighter text-black/30">{c.relationship}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-[#5a5a40]/60 italic">No active connections found.</p>
                      )}

                      <div className="pt-4 border-t border-[#5a5a40]/10">
                        <p className="text-[8px] uppercase tracking-widest font-bold text-black/20 mb-2">Link to Node</p>
                        <select 
                          onChange={(e) => handleCreateConnection(parseInt(e.target.value))}
                          className="w-full text-[10px] bg-white border border-black/5 rounded p-1 outline-none"
                          value=""
                        >
                          <option value="" disabled>Select node...</option>
                          {notes.filter(n => n.id !== selectedNote.id).map(n => (
                            <option key={n.id} value={n.id}>{n.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="w-24 h-24 bg-black/5 rounded-full flex items-center justify-center mb-8">
                <Sparkles className="w-10 h-10 text-black/20" />
              </div>
              <h2 className="text-3xl font-light serif italic mb-4">Select a node to explore</h2>
              <p className="text-black/40 max-w-xs text-sm">Your knowledge graph is waiting to be expanded. Create a new research node to begin.</p>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
