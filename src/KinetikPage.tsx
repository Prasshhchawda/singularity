import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock, Loader2, X } from "lucide-react";
import "./KinetikPage.css";

type Employee = {
  id: string;
  name: string;
  role: string;
  category: string;
  desc: string;
  skills: number;
  tag: string;
  icon: string;
  color: string;
};

const fallbackEmployees: Employee[] = [
  { id: "nova", name: "NOVA", role: "AI Sales Rep", category: "Sales", desc: "Outbound, lead qualifying & follow-ups", skills: 4, tag: "Bestseller", icon: "🤝", color: "#df3215" },
  { id: "atlas", name: "ATLAS", role: "AI Support Agent", category: "Support", desc: "Tickets, live chat & email in 40+ languages", skills: 5, tag: "Most Hired", icon: "🎧", color: "#1754ff" },
  { id: "echo", name: "ECHO", role: "AI Social Media Manager", category: "Marketing", desc: "Posts, captions, scheduling & DMs", skills: 4, tag: "Just In", icon: "#", color: "#ed2490" },
  { id: "ledger", name: "LEDGER", role: "AI Bookkeeper", category: "Finance", desc: "Invoices, expenses & monthly reports", skills: 3, tag: "GST Ready", icon: "▦", color: "#008752" },
  { id: "scout", name: "SCOUT", role: "AI Recruiter", category: "People & Ops", desc: "Sourcing, screening & interview booking", skills: 4, tag: "New Skills Added", icon: "♟", color: "#ffa500" },
  { id: "quill", name: "QUILL", role: "AI Content Writer", category: "Marketing", desc: "Blogs, SEO pages, emails & ad copy", skills: 5, tag: "Bestseller", icon: "✒", color: "#8539e9" },
  { id: "pulse", name: "PULSE", role: "AI Data Analyst", category: "Finance", desc: "Dashboards, forecasts & weekly insights", skills: 3, tag: "Just In", icon: "↗", color: "#00a0ba" },
];

const categories = ["All", "Sales", "Support", "Marketing", "Finance", "People & Ops", "Analytics"];
const slots = ["10:00 AM", "12:30 PM", "3:00 PM", "6:00 PM"];

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function upcomingWeekdays() {
  const dates: Date[] = [];
  const current = new Date();

  for (let i = 0; dates.length < 14 && i <= 30; i++) {
    const date = new Date(current);
    date.setDate(current.getDate() + i);
    if (i === 0 || (date.getDay() !== 0 && date.getDay() !== 6)) dates.push(date);
  }

  return dates;
}

const dates = upcomingWeekdays();
const todayKey = dateKey(dates[0] ?? new Date());

function timeToMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return -1;
  let hours = Number(match[1]) % 12;
  if (match[3]?.toUpperCase() === "PM") hours += 12;
  return hours * 60 + Number(match[2]);
}

function selectedTimeToIso(date: string, time: string) {
  const minutes = timeToMinutes(time);
  if (minutes < 0) throw new Error("Choose a valid call time.");
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainingMinutes = String(minutes % 60).padStart(2, "0");
  return new Date(`${date}T${hours}:${remainingMinutes}:00+05:30`).toISOString();
}

function formatCustomTime(value: string) {
  if (!value) return "";
  const [hoursText, minutes] = value.split(":");
  let hours = Number(hoursText);
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}

function istMinutesNow() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0") % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
  return hour * 60 + minute;
}

export default function KinetikPage() {
  const navigate = useNavigate();
  const employees = fallbackEmployees;
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [timeSlots, setTimeSlots] = useState(slots);
  const [slotError, setSlotError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const filtered = employees.filter((person) => {
    const matchesCategory = category === "All" || person.category === category;
    const matchesSearch =
      person.name.toLowerCase().includes(search.toLowerCase()) ||
      person.role.toLowerCase().includes(search.toLowerCase()) ||
      person.category.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (id: string) => {
    setCart((old) => (old.includes(id) ? old : [...old, id]));
    setShowCart(true);
  };

  const removeFromCart = (id: string) => {
    setCart((old) => old.filter((item) => item !== id));
  };

  const toggleFavorite = (id: string) => {
    setFavorites((old) =>
      old.includes(id) ? old.filter((item) => item !== id) : [...old, id],
    );
  };

  const scrollToCrew = () => {
    document.getElementById("crew")?.scrollIntoView({ behavior: "smooth" });
  };

  const hireAll = () => {
    setCart(employees.map((person) => person.id));
    setShowCart(true);
  };

  const money = cart.length * 1000;
  const selectedEmployees = cart
    .map((id) => employees.find((item) => item.id === id))
    .filter((person): person is Employee => Boolean(person));

  const availableSlots = selectedDate === todayKey
    ? timeSlots.filter((slot) => timeToMinutes(slot) > istMinutesNow())
    : timeSlots;

  const addCustomTime = () => {
    setSlotError("");
    const formatted = formatCustomTime(customTime);
    if (!formatted) {
      setSlotError("Choose a custom time.");
      return;
    }
    if (timeSlots.includes(formatted)) {
      setSlotError("That time slot already exists.");
      return;
    }
    setTimeSlots((old) => [...old, formatted].sort((a, b) => timeToMinutes(a) - timeToMinutes(b)));
    setCustomTime("");
  };

  const removeTimeSlot = (slot: string) => {
    setTimeSlots((old) => old.filter((item) => item !== slot));
    if (selectedTime === slot) setSelectedTime("");
  };

  const confirmBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBookingError("");

    if (!selectedDate || !selectedTime) {
      setBookingError("Please choose a date and time.");
      return;
    }

    if (!clientName.trim() || !email.trim() || !companyName.trim()) {
      setBookingError("Please complete your details.");
      return;
    }

    setBookingLoading(true);
    try {
      const callId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const scheduledAt = selectedTimeToIso(selectedDate, selectedTime);
      window.sessionStorage.setItem(
        "kinetik-meeting-demo",
        JSON.stringify({ callId, createdAt, scheduledAt }),
      );
      await navigate({
        to: "/get-agent",
        search: { callId, demo: true },
        replace: true,
      });
    } catch (error) {
      console.error("Could not start the meeting demo:", error);
      setBookingError("The demo timer could not start in this browser. Please enable session storage and try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="kinetik-site">
      <header className="kinetik-navbar">
        <button className="kinetik-logo" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="kinetik-logo-icon">ϟ</span>
          KINETIK
        </button>

        <nav className="kinetik-nav-links" aria-label="AI employee categories">
          {categories.slice(1).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => {
                setCategory(item);
                scrollToCrew();
              }}
            >
              {item}
            </button>
          ))}
          <button type="button" onClick={() => { setCategory("All"); scrollToCrew(); }}>
            New Hires
          </button>
        </nav>

        <div className="kinetik-nav-right">
          <label className="kinetik-search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search AI talent"
              placeholder="Search AI talent"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                scrollToCrew();
              }}
            />
          </label>
          <button className="kinetik-nav-icon" type="button" aria-label="Favorites" onClick={() => scrollToCrew()}>
            ♡
          </button>
          <button className="kinetik-nav-icon" type="button" aria-label={`Cart with ${cart.length} items`} onClick={() => setShowCart(true)}>
            ▣<span className="kinetik-cart-count">{cart.length}</span>
          </button>
        </div>
      </header>

      {checkout ? (
        <main className="kinetik-booking-backdrop" onMouseDown={() => setCheckout(false)}>
          <section
            className="kinetik-booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="kinetik-booking-close"
              type="button"
              aria-label="Close booking"
              onClick={() => setCheckout(false)}
            >
              <X size={20} />
            </button>

              <div className="kinetik-booking-heading">
                  <span>LOCAL DEMO · NO REAL BOOKING</span>
                  <h2 id="booking-title">Let's build your AI employee.</h2>
                  <p>
                    Tell us about your business. We'll customise{" "}
                    {selectedEmployees.map((person) => person.name).join(", ") || "your employee"}{" "}
                    around your workflow.
                  </p>
                  <p className="kinetik-form-note">
                    Demo only: this continues to a local timer. No call is booked and access codes are not validated.
                  </p>
                </div>

                <div className="kinetik-selected-employees">
                  {selectedEmployees.map((person) => (
                    <div className="kinetik-selected-employee" key={person.id}>
                      <span
                        className="kinetik-employee-avatar"
                        style={{ background: `${person.color}18`, color: person.color }}
                      >
                        {person.name[0]}
                      </span>
                      <div>
                        <strong>{person.name}</strong>
                        <p>{person.role}</p>
                      </div>
                      <span className="kinetik-selected-label">Selected</span>
                    </div>
                  ))}
                </div>

                <form onSubmit={confirmBooking}>
                  <label>Choose a date</label>
                  <div className="kinetik-date-grid">
                    {dates.map((date) => {
                      const key = dateKey(date);
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`kinetik-date-option ${selectedDate === key ? "chosen" : ""}`}
                          onClick={() => setSelectedDate(key)}
                        >
                          <span>{date.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}</span>
                          <strong>{date.toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" })}</strong>
                          <small>{date.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</small>
                        </button>
                      );
                    })}
                  </div>

                  <label>Select a time · India Standard Time</label>
                  <div className="kinetik-time-grid">
                    {availableSlots.map((slot) => (
                      <div className="kinetik-time-slot-wrap" key={slot}>
                        <button
                          type="button"
                          className={`kinetik-time-option ${selectedTime === slot ? "chosen" : ""}`}
                          onClick={() => setSelectedTime(slot)}
                        >
                          <Clock size={14} /> {slot}
                        </button>
                        <button
                          type="button"
                          className="kinetik-remove-slot"
                          aria-label={`Remove ${slot}`}
                          onClick={() => removeTimeSlot(slot)}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {availableSlots.length === 0 && (
                    <p className="kinetik-no-slots">No future time slots remain for today. Choose tomorrow.</p>
                  )}

                  <div className="kinetik-custom-slot">
                    <input
                      aria-label="Custom time slot"
                      type="time"
                      value={customTime}
                      onChange={(event) => setCustomTime(event.target.value)}
                    />
                    <button type="button" onClick={addCustomTime}>Add Time Slot</button>
                  </div>
                  {slotError && <p className="kinetik-slot-error">{slotError}</p>}

                  <label>Your details</label>
                  <div className="kinetik-form-grid">
                    <input
                      required
                      placeholder="Client name"
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                    />
                    <input
                      required
                      type="email"
                      placeholder="Work email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <input
                      required
                      placeholder="Company name"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                    />
                  </div>

                  {bookingError && <p className="kinetik-booking-error">{bookingError}</p>}

                  <button className="kinetik-primary-full" disabled={bookingLoading} type="submit">
                    {bookingLoading ? <Loader2 className="kinetik-spin" size={18} /> : <CalendarDays size={18} />}
                    {bookingLoading ? "Opening demo..." : "Continue to demo timer"}
                  </button>
                  <p className="kinetik-form-note">No Supabase connection is used in this demo.</p>
              </form>
          </section>
        </main>
      ) : (
        <>
          <section className="kinetik-hero">
            <div className="kinetik-hero-content">
              <div className="kinetik-eyebrow">The AI Workforce Collection</div>
              <h1>WORK NEVER<br />SLEEPS.</h1>
              <p>
                7 elite AI employees, trained for sales, support, marketing,
                finance and hiring. Clock in today for ₹1,000 a month each.
              </p>
              <div className="kinetik-hero-buttons">
                <button className="kinetik-btn-white" type="button" onClick={scrollToCrew}>Hire Now</button>
                <button className="kinetik-btn-outline" type="button" onClick={scrollToCrew}>Meet the Crew</button>
              </div>
            </div>
          </section>

          <section className="kinetik-crew" id="crew">
            <div className="kinetik-shop-label">Shop all AI employees ({employees.length})</div>
            <div className="kinetik-crew-heading">
              <h2>MEET THE CREW</h2>
              <span className="kinetik-sort">Sort by: &nbsp; Featured⌄</span>
            </div>

            <div className="kinetik-filters">
              {categories.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`kinetik-filter ${category === item ? "active" : ""}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="kinetik-employee-grid">
              {filtered.map((person) => (
                <article className="kinetik-employee-card" key={person.id}>
                  <div className="kinetik-employee-image">
                    <span className="kinetik-employee-letter">{person.name[0]}</span>
                    <div className="kinetik-employee-icon" style={{ background: person.color }}>
                      {person.icon}
                    </div>
                    <button
                      className={`kinetik-favorite ${favorites.includes(person.id) ? "selected" : ""}`}
                      type="button"
                      aria-label={`${favorites.includes(person.id) ? "Remove" : "Add"} ${person.name} ${favorites.includes(person.id) ? "from" : "to"} favorites`}
                      onClick={() => toggleFavorite(person.id)}
                    >
                      {favorites.includes(person.id) ? "♥" : "♡"}
                    </button>
                  </div>
                  <div className="kinetik-employee-info">
                    <div className="kinetik-tag">{person.tag}</div>
                    <div className="kinetik-employee-name">{person.name} — {person.role}</div>
                    <div className="kinetik-employee-desc">{person.desc}</div>
                    <div className="kinetik-skills">{person.skills} Skills</div>
                    <div className="kinetik-price"><b>₹1,000</b> <span>/ month</span></div>
                    <button className="kinetik-hire-small" type="button" onClick={() => addToCart(person.id)}>
                      {cart.includes(person.id) ? "Added ✓" : "Hire Now"}
                    </button>
                  </div>
                </article>
              ))}

              {filtered.length === 0 && (
                <p>No AI employees are currently available.</p>
              )}
              {category === "All" && search === "" && employees.length > 0 && (
                <div className="kinetik-bundle">
                  <small>Bundle</small>
                  <h2>HIRE THE<br />FULL SQUAD</h2>
                  <p>All {employees.length} AI employees working as one team.</p>
                  <button type="button" onClick={hireAll}>Hire all {employees.length}</button>
                </div>
              )}
            </div>
          </section>

          <section className="kinetik-featured">
            <h2>Featured</h2>
            <div className="kinetik-featured-grid">
              <div className="kinetik-feature-card red">
                <div className="kinetik-feature-icon">🤝</div>
                <span>NOVA · AI Sales Rep</span>
                <h3>CLOSES DEALS<br />WHILE YOU SLEEP</h3>
                <button
                  type="button"
                  disabled={!employees.some((employee) => employee.name.toUpperCase() === "NOVA")}
                  onClick={() => {
                    const employee = employees.find((item) => item.name.toUpperCase() === "NOVA");
                    if (employee) addToCart(employee.id);
                  }}
                >
                  Hire for ₹1,000/mo
                </button>
              </div>
              <div className="kinetik-feature-card blue">
                <div className="kinetik-feature-icon">🌐</div>
                <span>ATLAS · AI Support Agent</span>
                <h3>EVERY TICKET.<br />EVERY TIMEZONE.</h3>
                <button
                  type="button"
                  disabled={!employees.some((employee) => employee.name.toUpperCase() === "ATLAS")}
                  onClick={() => {
                    const employee = employees.find((item) => item.name.toUpperCase() === "ATLAS");
                    if (employee) addToCart(employee.id);
                  }}
                >
                  Hire for ₹1,000/mo
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="kinetik-footer">
        <div className="kinetik-footer-grid">
          {[
            ["Resources", "Hiring Guides", "Integrations", "Become an AI Builder"],
            ["Help", "Billing", "Cancel a Hire", "Contact Us"],
            ["Company", "About Kinetik", "Careers", "Security"],
            ["Follow", "◎ Instagram", "in LinkedIn", "▶ YouTube"],
          ].map(([title, ...links]) => (
            <div className="kinetik-footer-col" key={title}>
              <h3>{title}</h3>
              {links.map((link) => <p key={link}>{link}</p>)}
            </div>
          ))}
        </div>
        <div className="kinetik-footer-bottom">
          <span>📍 India · © 2025 Kinetik AI Workforce. All rights reserved.</span>
          <span>Terms　　Privacy　　Refund Policy</span>
        </div>
      </footer>

      {showCart && (
        <>
          <div className="kinetik-overlay" onClick={() => setShowCart(false)} />
          <aside className="kinetik-cart-panel" aria-label="Your hires">
            <div className="kinetik-cart-header">
              <span>Your Hires</span>
              <button className="kinetik-close" type="button" aria-label="Close cart" onClick={() => setShowCart(false)}>×</button>
            </div>

            <div className="kinetik-cart-items">
              {cart.length === 0 ? (
                <div className="kinetik-empty">Your squad is empty.<br />Hire your first AI employee!</div>
              ) : (
                cart.map((id) => {
                  const person = employees.find((item) => item.id === id);
                  return person ? (
                    <div className="kinetik-cart-item" key={id}>
                      <div className="kinetik-cart-letter">{person.name[0]}</div>
                      <div className="kinetik-cart-item-info">
                        <strong>{person.name}</strong>
                        <p>{person.role}</p>
                      </div>
                      <div className="kinetik-cart-item-price">
                        <strong>₹1,000/mo</strong>
                        <br />
                        <button className="kinetik-remove" type="button" onClick={() => removeFromCart(id)}>Remove</button>
                      </div>
                    </div>
                  ) : null;
                })
              )}
            </div>

            <div className="kinetik-cart-footer">
              <div className="kinetik-total-row">
                <span>Monthly total</span>
                <strong>₹{money.toLocaleString("en-IN")}</strong>
              </div>
              <small>Billed monthly. Cancel anytime.</small>
              <button
                className="kinetik-checkout-btn"
                type="button"
                disabled={cart.length === 0}
                onClick={() => {
                  setShowCart(false);
                  setCheckout(true);
                }}
              >
                Checkout
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
