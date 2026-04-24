import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  
  private baseUrl = "https://ebenezeriot.share.zrok.io/api"; 
  
  // 🛡️ CABECERAS OBLIGATORIAS PARA ZROK/NGROK
  // Esto evita que Zrok devuelva una pantalla HTML de advertencia en lugar de tus datos
  private headersTubo = new HttpHeaders({
    'ngrok-skip-browser-warning': 'true',
    'Bypass-Tunnel-Reminder': 'true'
  });

  constructor(private http: HttpClient) { }

  // ==============================================================
  // 1. DASHBOARD 
  // ==============================================================
  obtenerDashboard(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/dashboard`, { headers: this.headersTubo });
  }

  // ==============================================================
  // 2. CONTROL TOTAL
  // ==============================================================
  enviarComando(datos: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/control`, datos, { headers: this.headersTubo });
  }

  // ==============================================================
  // 3. HISTORIAL
  // ==============================================================
  obtenerHistorial(inicio?: string, fin?: string): Observable<any[]> {
    let params = new HttpParams();
    if (inicio) params = params.set('inicio', inicio);
    if (fin) params = params.set('fin', fin);
    
    return this.http.get<any[]>(`${this.baseUrl}/mediciones`, { headers: this.headersTubo, params });
  }

  // ==============================================================
  // 4. BITÁCORA
  // ==============================================================
  obtenerBitacora(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/bitacora`, { headers: this.headersTubo });
  }
}