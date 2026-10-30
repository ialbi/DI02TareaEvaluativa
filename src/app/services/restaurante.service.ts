import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, addDoc, deleteDoc, doc, setDoc } from '@angular/fire/firestore';
import { Restaurante } from '../interface/restaurante';

@Injectable({ providedIn: 'root' })
export class RestauranteService {

  private firestore = inject(Firestore);
  private readonly COLECCION = 'restaurantesColeccion';

  // Obtiene todos los restaurantes de Firestore (incluye el id del documento)
  async getAll(): Promise<Restaurante[]> {
    const snapshot = await getDocs(collection(this.firestore, this.COLECCION));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Restaurante));
  }

  // Borra un único restaurante por su id de documento
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.COLECCION, id));
  }

  // Borra todos los documentos de la colección
  async deleteAll(): Promise<void> {
    const snapshot = await getDocs(collection(this.firestore, this.COLECCION));
    await Promise.all(
      snapshot.docs.map(d => deleteDoc(doc(this.firestore, this.COLECCION, d.id)))
    );
  }
  /* H3.3 - Control y libertad del usuario.
  Restaura un restaurante eliminado manteniendo
  su ID original de Firebase. */
  async restore(restaurante: Restaurante): Promise<void> {
    if (!restaurante.id) {
      throw new Error('El restaurante no tiene ID');
    }

    const documento = doc(
      this.firestore,
      this.COLECCION,
      restaurante.id
    );

    const { id, ...datos } = restaurante;

    await setDoc(documento, datos);
  }
  /* Añade un array de restaurantes a la colección, 
     H1.1 - Visibilidad del estado del sistema.
     Callback que informa del número de restaurantes
     importados correctamente para actualizar la barra. */
  async addAll(
    restaurantes: Restaurante[],
    onProgress?: (importados: number) => void
  ): Promise<void> {

    const col = collection(this.firestore, this.COLECCION);
    let importados = 0;

    for (const r of restaurantes) {
      await addDoc(col, r);

      importados++;
      onProgress?.(importados);
    }
  }

  // Añade un único restaurante a la colección
  async add(restaurante: Restaurante): Promise<void> {
    const col = collection(this.firestore, this.COLECCION);
    await addDoc(col, restaurante);
  }
}
