import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// Si creaste el archivo de interfaces, descomenta la siguiente línea:
// import { DashboardResponse, Medicion } from '../interfaces/acuario.interface';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  
  // Tu IP local de Laravel (Asegúrate que sea la correcta)
  private baseUrl = 'http://192.168.0.90:8000/api'; 

  constructor(private http: HttpClient) { }

  // ==============================================================
  // 1. DASHBOARD (Antes 'obtenerEstadoActual')
  // Trae la última medición de sensores + el estado de los botones
  // ==============================================================
  obtenerDashboard(): Observable<any> {
    // Apunta a la función index() de AcuarioController
    return this.http.get<any>(`${this.baseUrl}/dashboard`);
  }

  // ==============================================================
  // 2. CONTROL TOTAL (Antes 'configurar')
  // Sirve para: Relés, Modo, Ventilador y Llenado
  // Laravel espera un JSON como { "r1": true } o { "fan_cmd": 1 }
  // ==============================================================
  enviarComando(datos: any): Observable<any> {
    // Apunta a la función updateState() de AcuarioController
    return this.http.post(`${this.baseUrl}/control`, datos);
  }

  // ==============================================================
  // 3. HISTORIAL (Para la tabla y gráficos)
  // ==============================================================
  obtenerHistorial(inicio?: string, fin?: string): Observable<any[]> {
    let params = new HttpParams();
    // Si quieres filtrar por fecha en el futuro
    if (inicio) params = params.set('inicio', inicio);
    if (fin) params = params.set('fin', fin);
    
    // Apunta a la función index() (GET) de AcuarioController
    return this.http.get<any[]>(`${this.baseUrl}/mediciones`, { params });
  }

  // ==============================================================
  // 4. BITÁCORA (Opcional)
  // ==============================================================
  obtenerBitacora(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/bitacora`);
  }
} 