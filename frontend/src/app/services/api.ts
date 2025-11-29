import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // AJUSTA ESTA IP A LA DE TU PC
  private baseUrl = 'http://192.168.0.90:8000/api'; 

  constructor(private http: HttpClient) { }

  obtenerMediciones(inicio: string = '', fin: string = ''): Observable<any> {
    let params = `?t=${new Date().getTime()}`; // Truco para evitar caché
    if (inicio) params += `&inicio=${inicio}`;
    if (fin) params += `&fin=${fin}`;
    
    return this.http.get(`${this.baseUrl}/mediciones${params}`);
  }

  obtenerEstadoActual(): Observable<any> {
    return this.http.get(`${this.baseUrl}/estado-actual`);
  }

  // ACEPTAMOS UN OBJETO COMPLETO CON LA CONFIGURACIÓN
  enviarConfiguracion(config: any): Observable<any> {
    // Laravel espera: modo, relay1_status, relay2_status, relay1_enabled, relay2_enabled
    const payload = {
      modo: config.modo,
      relay1_status: config.relay1,
      relay2_status: config.relay2,
      relay1_enabled: config.relay1_enabled, // Nuevo
      relay2_enabled: config.relay2_enabled  // Nuevo
    };
    return this.http.post(`${this.baseUrl}/configurar`, payload);
  }
}