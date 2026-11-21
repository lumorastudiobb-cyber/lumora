'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin.module.css';
import {
  BOOKINGS_STORAGE_KEY,
  DB_STORAGE_KEY,
  LumoraInquiry,
  LumoraOrder,
  ORDER_TRACKING_STAGES,
  OrderStageKey,
  USD_TO_BBD_RATE,
  getDatabase,
  safeText,
  saveDatabase,
  syncFromStorefront,
} from '@/lib/store';

export default function AdminClient() {
  const [activeCurrency, setActiveCurrency] = useState<'BBD' | 'USD'>('BBD');
  const [isLightMode, setIsLightMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'inquiries' | 'accounting'>('orders');
  const [orders, setOrders] = useState<LumoraOrder[]>([]);
  const [inquiries, setInquiries] = useState<LumoraInquiry[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [adminReplyInput, setAdminReplyInput] = useState('');
  const [inquiryReplyInput, setInquiryReplyInput] = useState('');
  const [deliverableLinkInput, setDeliverableLinkInput] = useState('');
  const [deliverableFile, setDeliverableFile] = useState<File | null>(null);

  const loadSyncedState = () => {
    const syncedOrders = syncFromStorefront();
    const db = getDatabase();
    setOrders([...syncedOrders]);
    setInquiries([...db.inquiries]);
  };

  useEffect(() => {
    loadSyncedState();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === DB_STORAGE_KEY || e.key === BOOKINGS_STORAGE_KEY) {
        loadSyncedState();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const formatMoney = (usdAmount: number) => {
    const val = activeCurrency === 'BBD' ? usdAmount * USD_TO_BBD_RATE : usdAmount;
    return `$${val.toFixed(2)} ${activeCurrency}`;
  };

  let depositsTotal = 0;
  let pendingTotal = 0;
  let finalizedTotal = 0;
  let pipelineTotal = 0;

  orders.forEach((o) => {
    pipelineTotal += o.totalUsd;
    if (o.finalSettled) {
      finalizedTotal += o.totalUsd;
      depositsTotal += o.depositPaidUsd;
    } else {
      depositsTotal += o.depositPaidUsd;
      pendingTotal += o.totalUsd - o.depositPaidUsd;
    }
  });

  const handleSelectOrder = (orderId: string) => {
    setSelectedRecordId(orderId);
    const db = getDatabase();
    const order = db.orders.find((o) => o.id === orderId);
    if (order && order.hasUnreadClientReply) {
      order.hasUnreadClientReply = false;
      saveDatabase(db);
      setOrders([...db.orders]);
    }
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStageKey) => {
    const db = getDatabase();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.status = newStatus;
    if (newStatus === 'review' && order.draftApproval?.status === 'revisions_requested') {
      order.draftApproval = { status: 'pending' };
    }
    order.updatedAt = new Date().toISOString();
    saveDatabase(db);
    setOrders([...db.orders]);
  };

  const handleMarkFinalBalancePaid = (orderId: string) => {
    const db = getDatabase();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.finalSettled = true;
    saveDatabase(db);
    setOrders([...db.orders]);
  };

  const handlePublishDeliverable = (orderId: string) => {
    const db = getDatabase();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return;

    if (deliverableFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        order.deliverables = order.deliverables || [];
        order.deliverables.push({
          name: deliverableFile.name,
          type: deliverableFile.type || 'Studio File',
          dataUrl: e.target?.result as string,
          uploadedAt: new Date().toLocaleDateString(),
        });
        if (order.status !== 'completed') order.status = 'review';
        order.draftApproval = { status: 'pending' };
        saveDatabase(db);
        setDeliverableFile(null);
        setOrders([...db.orders]);
      };
      reader.readAsDataURL(deliverableFile);
    } else if (deliverableLinkInput.trim() !== '') {
      order.deliverables = order.deliverables || [];
      order.deliverables.push({
        name: 'Bespoke Interactive Experience Link',
        type: 'Live URL',
        url: deliverableLinkInput.trim(),
        uploadedAt: new Date().toLocaleDateString(),
      });
      if (order.status !== 'completed') order.status = 'review';
      order.draftApproval = { status: 'pending' };
      saveDatabase(db);
      setDeliverableLinkInput('');
      setOrders([...db.orders]);
    } else {
      alert('Please attach a finished file or paste a live project URL.');
    }
  };

  const handleRemoveDeliverable = (orderId: string, index: number) => {
    const db = getDatabase();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.deliverables.splice(index, 1);
    saveDatabase(db);
    setOrders([...db.orders]);
  };

  const handleSendClientMessage = (orderId: string) => {
    if (!adminReplyInput.trim()) return;
    const db = getDatabase();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.messages = order.messages || [];
    order.messages.push({
      sender: 'LUMORA Studio',
      text: adminReplyInput.trim(),
      timestamp: new Date().toISOString(),
    });
    saveDatabase(db);
    setAdminReplyInput('');
    setOrders([...db.orders]);
  };

  const handleReplyToInquiry = (inqId: string) => {
    if (!inquiryReplyInput.trim()) return;
    const db = getDatabase();
    const inq = db.inquiries.find((i) => i.id === inqId);
    if (!inq) return;
    inq.replies = inq.replies || [];
    inq.replies.push({ text: inquiryReplyInput.trim(), timestamp: new Date().toISOString() });
    inq.status = 'Responded';
    saveDatabase(db);
    setInquiryReplyInput('');
    setInquiries([...db.inquiries]);
  };

  const exportAccountingCSV = () => {
    const rate = activeCurrency === 'BBD' ? USD_TO_BBD_RATE : 1;
    const headers = [
      'Order ID',
      'Order Date',
      'Client Name',
      'Email',
      'Package Tier',
      'Selected Add-Ons',
      'Event Date',
      `Total Contract (${activeCurrency})`,
      `Deposit Collected (${activeCurrency})`,
      `Pending Balance (${activeCurrency})`,
      `Finalized Revenue (${activeCurrency})`,
      'Accounting Status',
      'Production Stage',
      'Draft Approval',
    ];

    const rows = orders.map((o) => {
      const total = (o.totalUsd * rate).toFixed(2);
      const deposit = (o.depositPaidUsd * rate).toFixed(2);
      const pending = o.finalSettled ? '0.00' : ((o.totalUsd - o.depositPaidUsd) * rate).toFixed(2);
      const finalized = o.finalSettled ? total : '0.00';
      const addons = (o.intakeSpecs?.selectedAddons || []).map((a) => a.name).join('; ') || 'None';
      return [
        o.id,
        new Date(o.createdAt).toISOString().split('T')[0],
        `"${o.clientName.replace(/"/g, '""')}"`,
        o.email,
        `"${o.packageName}"`,
        `"${addons.replace(/"/g, '""')}"`,
        o.eventDate,
        total,
        deposit,
        pending,
        finalized,
        o.finalSettled ? 'Settled' : 'Deposit Only',
        o.status,
        o.draftApproval?.status || 'pending',
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `LUMORA_Accounting_Ledger_${activeCurrency}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const queryLower = searchQuery.toLowerCase();
  const filteredOrders = orders.filter((o) => {
    const matchesText =
      o.clientName.toLowerCase().includes(queryLower) ||
      o.id.toLowerCase().includes(queryLower) ||
      o.eventTitle.toLowerCase().includes(queryLower);
    const matchesStage = statusFilter === 'all' || o.status === statusFilter;
    return matchesText && matchesStage;
  });

  const selectedOrder = activeTab === 'orders' ? orders.find((o) => o.id === selectedRecordId) : null;
  const selectedInquiry = activeTab === 'inquiries' ? inquiries.find((i) => i.id === selectedRecordId) : null;

  return (
    <div className={`${styles.adminRoot} ${isLightMode ? styles.lightMode : ''}`}>
      <div className={styles.noiseOverlay} />

      <header className={styles.adminTopbar}>
        <div className={styles.brandCluster}>
          <span className={styles.brandTitle}>LUMORA</span>
          <span className={styles.adminBadge}>Atelier Command</span>
        </div>

        <div className={styles.topbarActions}>
          <Link href="/" className={styles.pillBtn}>
            ← Storefront
          </Link>
          <button className={styles.pillBtn} onClick={loadSyncedState}>
            ↻ Sync Orders
          </button>
          <button
            className={styles.pillBtn}
            onClick={() => setActiveCurrency((prev) => (prev === 'BBD' ? 'USD' : 'BBD'))}
            id="currency-toggle-btn"
          >
            {activeCurrency} $
          </button>
          <button
            className={styles.pillBtn}
            onClick={() => setIsLightMode((prev) => !prev)}
            id="theme-toggle-btn"
          >
            {isLightMode ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button className={`${styles.pillBtn} ${styles.pillBtnPrimary}`} onClick={exportAccountingCSV}>
            ↓ Export Accounting CSV
          </button>
        </div>
      </header>

      <main className={styles.adminContainer}>
        <section className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Deposits Collected</span>
            <span className={styles.kpiValue} id="kpi-deposits">
              {formatMoney(depositsTotal)}
            </span>
            <span className={styles.kpiSub}>50% Retainers Secured</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Pending Balances</span>
            <span className={styles.kpiValue} id="kpi-pending">
              {formatMoney(pendingTotal)}
            </span>
            <span className={styles.kpiSub}>Due Prior to Final Handoff</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Finalized Sales Revenue</span>
            <span className={styles.kpiValue} id="kpi-final">
              {formatMoney(finalizedTotal)}
            </span>
            <span className={styles.kpiSub}>100% Settled Commissions</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Active Pipeline Value</span>
            <span className={styles.kpiValue} id="kpi-pipeline">
              {formatMoney(pipelineTotal)}
            </span>
            <span className={styles.kpiSub} id="kpi-order-count">
              {orders.length} Total Commissions
            </span>
          </div>
        </section>

        <section className={styles.workspaceHeader}>
          <div className={styles.tabGroup}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('orders');
                setSelectedRecordId(null);
              }}
            >
              Commissions &amp; Orders
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'inquiries' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('inquiries');
                setSelectedRecordId(null);
              }}
            >
              Client Inquiries
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'accounting' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('accounting');
                setSelectedRecordId(null);
              }}
            >
              Accounting Ledger
            </button>
          </div>

          <div className={styles.filterControls}>
            <input
              type="text"
              id="search-input"
              className={styles.searchInput}
              placeholder="Search client, ID, or event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              id="status-filter"
              className={styles.selectControl}
              title="Filter by order stage"
              aria-label="Filter by order stage"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Stages</option>
              <option value="submitted">Order Submitted</option>
              <option value="viewed">Order Viewed</option>
              <option value="in_progress">Order in Progress</option>
              <option value="review">Ready for Review</option>
              <option value="completed">Order Completed</option>
            </select>
          </div>
        </section>

        {activeTab !== 'accounting' && (
          <section className={styles.workspaceGrid} id="split-workspace">
            <div className={styles.recordsList} id="records-list-container">
              {activeTab === 'orders' &&
                filteredOrders.map((order) => {
                  const stageObj =
                    ORDER_TRACKING_STAGES.find((s) => s.key === order.status) || ORDER_TRACKING_STAGES[0];
                  const balanceDue = order.finalSettled ? 0 : order.totalUsd - order.depositPaidUsd;
                  const approvalStatus = order.draftApproval?.status;

                  return (
                    <div
                      key={order.id}
                      className={`${styles.recordCard} ${
                        selectedRecordId === order.id ? styles.recordCardSelected : ''
                      }`}
                      onClick={() => handleSelectOrder(order.id)}
                    >
                      <div className={styles.recordMeta}>
                        <div className={styles.recordIdRow}>
                          <span>{order.id}</span>
                          <span>•</span>
                          <span>Event: {order.eventDate}</span>
                          {order.hasUnreadClientReply && (
                            <span className={`${styles.statusPill} ${styles.statusPillUnread}`}>
                              New Client Message
                            </span>
                          )}
                        </div>
                        <div
                          className={styles.recordClient}
                          dangerouslySetInnerHTML={{ __html: safeText(order.clientName) }}
                        />
                        <div className={styles.recordPkg}>
                          {order.packageName} — &ldquo;{order.eventTitle}&rdquo;
                        </div>
                      </div>
                      <div className={styles.recordFinancials}>
                        <span className={styles.statusPill}>{stageObj.label}</span>
                        {approvalStatus === 'approved' && (
                          <span className={`${styles.statusPill} ${styles.statusPillPaidFull}`}>
                            ✓ Draft Approved
                          </span>
                        )}
                        {approvalStatus === 'revisions_requested' && (
                          <span className={`${styles.statusPill} ${styles.statusPillBalanceDue}`}>
                            ✎ Revisions Requested
                          </span>
                        )}
                        <span
                          className={`${styles.statusPill} ${
                            order.finalSettled ? styles.statusPillPaidFull : styles.statusPillBalanceDue
                          }`}
                        >
                          {order.finalSettled ? 'Paid in Full' : `Balance: ${formatMoney(balanceDue)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {activeTab === 'inquiries' &&
                inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className={`${styles.recordCard} ${
                      selectedRecordId === inq.id ? styles.recordCardSelected : ''
                    }`}
                    onClick={() => setSelectedRecordId(inq.id)}
                  >
                    <div className={styles.recordMeta}>
                      <div className={styles.recordIdRow}>
                        <span>{inq.id}</span>
                        <span>•</span>
                        <span>Via {inq.channel}</span>
                      </div>
                      <div
                        className={styles.recordClient}
                        dangerouslySetInnerHTML={{ __html: safeText(inq.clientName) }}
                      />
                      <div className={styles.recordPkg}>{inq.subject}</div>
                    </div>
                    <div className={styles.recordFinancials}>
                      <span className={styles.statusPill}>{inq.status}</span>
                    </div>
                  </div>
                ))}
            </div>

            <aside className={styles.inspectorPane} id="inspector-pane">
              {!selectedOrder && !selectedInquiry && (
                <p className={styles.inspectorEmpty}>
                  Select an order or inquiry on the left to inspect full intake specifications (palette, itinerary, venue, add-ons), manage production stages, reply to Client Portal messages, reconcile balances, or upload drafts &amp; finished deliverables.
                </p>
              )}

              {selectedOrder && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <span className={styles.kpiLabel}>
                        {selectedOrder.id} • {selectedOrder.packageName}
                      </span>
                      <h2
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '1.9rem',
                          fontWeight: 300,
                          marginTop: '0.25rem',
                        }}
                        dangerouslySetInnerHTML={{ __html: safeText(selectedOrder.clientName) }}
                      />
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {selectedOrder.email} • {selectedOrder.phone || 'No phone'}
                      </p>
                    </div>
                    <span className={styles.statusPill}>
                      {selectedOrder.draftApproval?.status === 'approved'
                        ? '✓ Client Approved Draft'
                        : selectedOrder.draftApproval?.status === 'revisions_requested'
                        ? '✎ Client Requested Revisions'
                        : 'Awaiting Draft Sign-Off'}
                    </span>
                  </div>

                  <div className={styles.inspectorSection}>
                    <span className={styles.sectionHeading}>1. Full Client Intake Specifications</span>
                    <div className={styles.intakeSpecCard}>
                      <div className={styles.detailRow}>
                        <span>Event Title:</span>
                        <strong>{selectedOrder.eventTitle || '—'}</strong>
                      </div>
                      <div className={styles.detailRow}>
                        <span>Event Date:</span>
                        <strong>{selectedOrder.eventDate || '—'}</strong>
                      </div>
                      {selectedOrder.intakeSpecs?.venueName && (
                        <div className={styles.detailRow}>
                          <span>Venue:</span>
                          <strong>{selectedOrder.intakeSpecs.venueName}</strong>
                        </div>
                      )}
                      {selectedOrder.intakeSpecs?.venueAddress && (
                        <div className={styles.detailRow}>
                          <span>Address:</span>
                          <span>{selectedOrder.intakeSpecs.venueAddress}</span>
                        </div>
                      )}
                      {selectedOrder.intakeSpecs?.locationValue && (
                        <div className={styles.detailRow}>
                          <span>Map / Coords:</span>
                          <span>{selectedOrder.intakeSpecs.locationValue}</span>
                        </div>
                      )}
                      {selectedOrder.intakeSpecs?.amenities && (
                        <div className={styles.detailRow}>
                          <span>Amenities:</span>
                          <span>{selectedOrder.intakeSpecs.amenities.join(' • ') || 'None specified'}</span>
                        </div>
                      )}
                      {selectedOrder.intakeSpecs?.musicChoice && (
                        <div className={styles.detailRow}>
                          <span>Music Style:</span>
                          <strong>{selectedOrder.intakeSpecs.musicChoice}</strong>
                        </div>
                      )}
                      {selectedOrder.intakeSpecs?.giftRegistry && (
                        <div className={styles.detailRow}>
                          <span>Registry / Link:</span>
                          <span>{selectedOrder.intakeSpecs.giftRegistry}</span>
                        </div>
                      )}
                      {selectedOrder.intakeSpecs?.guestNotes && (
                        <div className={styles.detailRow}>
                          <span>Guest / Travel Notes:</span>
                          <span>{selectedOrder.intakeSpecs.guestNotes}</span>
                        </div>
                      )}

                      <div>
                        <div className={styles.sectionHeading} style={{ marginBottom: '0.4rem' }}>
                          Color Palette
                        </div>
                        {selectedOrder.intakeSpecs?.colorPalette &&
                        selectedOrder.intakeSpecs.colorPalette.length > 0 ? (
                          <div className={styles.paletteSwatchStrip}>
                            {selectedOrder.intakeSpecs.colorPalette.map((hex, i) => (
                              <span className={styles.swatchChip} key={i}>
                                <span className={styles.swatchDot} style={{ background: hex }} />
                                {hex}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Default studio palette
                          </span>
                        )}
                      </div>

                      {selectedOrder.intakeSpecs?.itineraryNotes && (
                        <div>
                          <div className={styles.sectionHeading} style={{ marginBottom: '0.4rem' }}>
                            Itinerary / Order of Service
                          </div>
                          <div className={styles.itineraryNoteBox}>
                            {selectedOrder.intakeSpecs.itineraryNotes}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className={styles.sectionHeading} style={{ marginBottom: '0.4rem' }}>
                          Selected Add-Ons
                        </div>
                        {selectedOrder.intakeSpecs?.selectedAddons &&
                        selectedOrder.intakeSpecs.selectedAddons.length > 0 ? (
                          <div className={styles.specTagList}>
                            {selectedOrder.intakeSpecs.selectedAddons.map((a) => (
                              <span className={styles.specTag} key={a.id}>
                                + {a.name} ({formatMoney(a.priceUsd)})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            No add-ons selected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.inspectorSection}>
                    <span className={styles.sectionHeading}>
                      2. Production Stage (Syncs to Client Portal)
                    </span>
                    <select
                      className={styles.selectControl}
                      value={selectedOrder.status}
                      onChange={(e) =>
                        handleUpdateOrderStatus(selectedOrder.id, e.target.value as OrderStageKey)
                      }
                    >
                      {ORDER_TRACKING_STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.inspectorSection}>
                    <span className={styles.sectionHeading}>3. Financial Reconciliation</span>
                    <div className={styles.detailRow}>
                      <span>Total Contract:</span>
                      <strong>{formatMoney(selectedOrder.totalUsd)}</strong>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Deposit Received:</span>
                      <span>{formatMoney(selectedOrder.depositPaidUsd)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Remaining Balance:</span>
                      <strong>
                        {formatMoney(
                          selectedOrder.finalSettled
                            ? 0
                            : selectedOrder.totalUsd - selectedOrder.depositPaidUsd
                        )}
                      </strong>
                    </div>
                    {!selectedOrder.finalSettled ? (
                      <button
                        className={`${styles.pillBtn} ${styles.pillBtnPrimary}`}
                        onClick={() => handleMarkFinalBalancePaid(selectedOrder.id)}
                      >
                        ✓ Record Final Payment (
                        {formatMoney(selectedOrder.totalUsd - selectedOrder.depositPaidUsd)})
                      </button>
                    ) : (
                      <span
                        className={`${styles.statusPill} ${styles.statusPillPaidFull}`}
                        style={{ textAlign: 'center' }}
                      >
                        Final Sale Settled &amp; Reconciled
                      </span>
                    )}
                  </div>

                  <div className={styles.inspectorSection}>
                    <span className={styles.sectionHeading}>
                      4. Publish Draft / Deliverable to Client Portal
                    </span>
                    <div className={styles.deliverableBox}>
                      <input
                        type="file"
                        className={styles.luxuryInput}
                        accept=".html,.pdf,.mp4,.mp3,.zip,image/*"
                        onChange={(e) =>
                          setDeliverableFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)
                        }
                      />
                      <input
                        type="text"
                        className={styles.luxuryInput}
                        placeholder="Or paste live LUMORA Canvas/Echo URL..."
                        value={deliverableLinkInput}
                        onChange={(e) => setDeliverableLinkInput(e.target.value)}
                      />
                      <button
                        className={`${styles.pillBtn} ${styles.pillBtnPrimary}`}
                        onClick={() => handlePublishDeliverable(selectedOrder.id)}
                      >
                        ↑ Publish to Client Portal
                      </button>
                    </div>
                    <div>
                      {(selectedOrder.deliverables || []).length > 0 ? (
                        selectedOrder.deliverables.map((d, idx) => (
                          <div className={styles.deliverableItem} key={idx}>
                            <span>
                              ✦ {d.name} ({d.uploadedAt})
                            </span>
                            <button
                              className={styles.pillBtn}
                              onClick={() => handleRemoveDeliverable(selectedOrder.id, idx)}
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          No drafts or deliverables published yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={styles.inspectorSection}>
                    <span className={styles.sectionHeading}>
                      5. Two-Way Client Portal Concierge Thread
                    </span>
                    <div className={styles.messageLog}>
                      {(selectedOrder.messages || []).length > 0 ? (
                        selectedOrder.messages.map((m, idx) => {
                          const isClient =
                            m.sender !== 'LUMORA Studio' && m.sender !== 'Studio';
                          return (
                            <div
                              key={idx}
                              className={`${styles.msgBubble} ${
                                isClient ? styles.msgBubbleClient : ''
                              }`}
                            >
                              <strong
                                dangerouslySetInnerHTML={{ __html: `${safeText(m.sender)}:` }}
                              />{' '}
                              <span dangerouslySetInnerHTML={{ __html: safeText(m.text) }} />
                            </div>
                          );
                        })
                      ) : (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          No messages exchanged yet.
                        </p>
                      )}
                    </div>
                    <textarea
                      className={styles.luxuryTextarea}
                      rows={2}
                      placeholder="Write a status note or reply visible in the client's portal..."
                      value={adminReplyInput}
                      onChange={(e) => setAdminReplyInput(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className={`${styles.pillBtn} ${styles.pillBtnPrimary}`}
                        onClick={() => handleSendClientMessage(selectedOrder.id)}
                      >
                        Post to Client Portal
                      </button>
                      <a
                        className={styles.pillBtn}
                        href={`mailto:${selectedOrder.email}?subject=LUMORA%20Studio%20Update%20(${selectedOrder.id})`}
                      >
                        Email Client
                      </a>
                    </div>
                  </div>
                </>
              )}

              {selectedInquiry && (
                <>
                  <div>
                    <span className={styles.kpiLabel}>
                      {selectedInquiry.id} • {selectedInquiry.channel} Inquiry
                    </span>
                    <h2
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.9rem',
                        fontWeight: 300,
                      }}
                      dangerouslySetInnerHTML={{ __html: safeText(selectedInquiry.clientName) }}
                    />
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {selectedInquiry.email}
                    </p>
                  </div>
                  <div className={styles.inspectorSection}>
                    <span className={styles.sectionHeading}>Client Inquiry</span>
                    <p
                      style={{ fontSize: '0.9rem', lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: safeText(selectedInquiry.message) }}
                    />
                  </div>
                  <div className={styles.inspectorSection}>
                    <span className={styles.sectionHeading}>Concierge Response</span>
                    <div className={styles.messageLog}>
                      {(selectedInquiry.replies || []).map((r, idx) => (
                        <div className={styles.msgBubble} key={idx}>
                          <strong>Atelier:</strong>{' '}
                          <span dangerouslySetInnerHTML={{ __html: safeText(r.text) }} />
                        </div>
                      ))}
                    </div>
                    <textarea
                      className={styles.luxuryTextarea}
                      rows={3}
                      placeholder="Draft bespoke response..."
                      value={inquiryReplyInput}
                      onChange={(e) => setInquiryReplyInput(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={`${styles.pillBtn} ${styles.pillBtnPrimary}`}
                        onClick={() => handleReplyToInquiry(selectedInquiry.id)}
                      >
                        Save &amp; Mark Responded
                      </button>
                      <a
                        className={styles.pillBtn}
                        href={`mailto:${selectedInquiry.email}?subject=Re:%20${encodeURIComponent(
                          selectedInquiry.subject
                        )}`}
                      >
                        Open in Mail
                      </a>
                    </div>
                  </div>
                </>
              )}
            </aside>
          </section>
        )}

        {activeTab === 'accounting' && (
          <section className={styles.ledgerTableWrapper} id="accounting-workspace">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Commission Tier</th>
                  <th>Add-Ons</th>
                  <th>Total Contract</th>
                  <th>Deposit Paid</th>
                  <th>Balance Pending</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const pending = o.finalSettled ? 0 : o.totalUsd - o.depositPaidUsd;
                  const addonList =
                    (o.intakeSpecs?.selectedAddons || []).map((a) => a.name).join(', ') || 'None';
                  return (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td dangerouslySetInnerHTML={{ __html: safeText(o.clientName) }} />
                      <td>{o.packageName}</td>
                      <td>{addonList}</td>
                      <td>{formatMoney(o.totalUsd)}</td>
                      <td>{formatMoney(o.depositPaidUsd)}</td>
                      <td>{formatMoney(pending)}</td>
                      <td>{o.finalSettled ? 'Settled (100%)' : '50% Deposit Paid'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
