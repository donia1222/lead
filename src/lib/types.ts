export interface Lead {
  id: string;
  name: string;
  sector: string;
  city: string;
  url: string;
  email: string;
  phone: string;
  contactPage: string;
  hasSSL: boolean;
  hasViewport: boolean;
  loadTime: number;
  score: number;
  problems: string[];
  status: "new" | "contacted" | "discarded";
  emailDraft: string;
  createdAt: string;
}

/** Un negocio recien inscrito en el registro de comercio (boletin SHAB/FOSC). */
export interface Nuevo {
  id: string;            // numero de publicacion del boletin, estable
  nombre: string;
  localidad: string;
  plz: string;
  direccion: string;
  uid: string;           // CHE-...
  forma: string;         // Einzelunternehmen, GmbH, AG...
  proposito: string;     // a que se dedica, segun el registro
  fecha: string;         // dia de publicacion
  km: number;            // distancia en linea recta
  minutos: number | null; // minutos en coche por carretera (null si no se pudo)
  web: string;           // web que se le ha encontrado, "" si ninguna
  email: string;
  telefono: string;
  webComprobada: boolean;
  estado: "nuevo" | "visitado" | "descartado";
  nota: string;
  creadoEn: string;
}
