import { Component, signal, computed, inject } from '@angular/core';
import { IonicModule, AlertController, ModalController, ToastController, LoadingController } from '@ionic/angular';

import { Restaurante } from '../interface/restaurante';
import { RestauranteService } from '../services/restaurante.service';
import { AddRestauranteModalComponent } from '../components/add-restaurante-modal/add-restaurante-modal.component';
import restaurantesJSON from '../../assets/datos/restaurantes.json';

import { addIcons } from 'ionicons';
import { globeOutline, star, sunny, trashOutline, restaurantOutline, closeCircle, lockClosedOutline, addOutline, cloudDownloadOutline, arrowUpOutline, arrowDownOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonicModule],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {

  // ############################### REGION DATOS ###############################

  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private modalCtrl = inject(ModalController);
  private restauranteService = inject(RestauranteService);

  constructor() {
    // H2.1 - Iconos reconocibles para web, premios Michelin, estrellas Repsol y Papelera.
    addIcons({ globeOutline, star, sunny, trashOutline, restaurantOutline, closeCircle, lockClosedOutline, addOutline, cloudDownloadOutline, arrowUpOutline, arrowDownOutline });
  }
  //Problemas con llamar a algunos iconos con name, asi que optamos por declararlos y llamar con [icon]
  trashIcon = trashOutline;
  restaurantIcon = restaurantOutline;
  closeCircleIcon = closeCircle;
  lockIcon = lockClosedOutline;
  addIcon = addOutline;
  cloudIcon = cloudDownloadOutline;
  // H6 - Reconocimiento antes que recuerdo.
// Indicamos visualmente el sentido de ordenación.
ordenAscendente = signal(true);

flechaArriba = arrowUpOutline;
flechaAbajo = arrowDownOutline;

cambiarOrden() {
  this.ordenAscendente.update(valor => !valor);
}

// Ordenamos los restaurantes filtrados sin modificar el array original.
restaurantesOrdenados = computed(() => {
  const restaurantes = [...this.restaurantesFiltrados()];

  return restaurantes.sort((a, b) => {
    const comparacion = a.documentName.localeCompare(
      b.documentName,
      'es',
      { sensitivity: 'base' }
    );

    return this.ordenAscendente() ? comparacion : -comparacion;
  });
});

  /* H3.2 - Control y libertad del usuario.
     Permite quitar una localidad sin perder los demás filtros. */
  quitarLocalidad(localidad: string) {
    this.localidadesSeleccionadas.update(localidades =>
      localidades.filter(loc => loc !== localidad)
    );
  }

  // Restaurantes leídos del JSON local (usados para la importación a Firebase)
  restaurantes: Restaurante[] = restaurantesJSON as Restaurante[];

  // Signal principal con los restaurantes actualmente cargados (vacío hasta que el usuario pulsa "Cargar datos")
  restaurantesCargados = signal<Restaurante[]>([]);

  // true durante la carga de datos
  cargando = signal(false);

  // true durante la importación del JSON a Firebase
  importando = signal(false);

  /* H1.1 - Visibilidad del estado del sistema.
     Estado de subida y contador real de documentos importados. */
  subiendo = signal(false);
  importados = signal(0);

  /* H1.1 - Calcula el progreso real entre 0 y 1.
     Ionic utiliza este valor para actualizar ion-progress-bar. */
  progreso = computed(() =>
    this.restaurantes.length > 0
      ? this.importados() / this.restaurantes.length
      : 0
  );

  // true cuando hay al menos un restaurante cargado
  hayDatos = computed(() => this.restaurantesCargados().length > 0);

  // Carga los restaurantes desde Firebase y muestra un toast de confirmación
  async cargarDatos() {
    this.cargando.set(true);
    try {
      // PRUEBA TEMPORAL H1.2: Simular error
      //throw new Error('Error de prueba');
      const datos = await this.restauranteService.getAll();
      this.restaurantesCargados.set(datos);
      this.mostrarToast(`${datos.length} restaurantes cargados`, 'success');
    } catch {
      this.mostrarToast('Error al cargar los datos desde Firebase', 'danger');
    } finally {
      this.cargando.set(false);
    }
  }
  // H4.2 - Solo permite quitar el territorio si no hay localidades.
  quitarTerritorio() {
    if (this.localidadesSeleccionadas().length > 0) {
      return;
    }

    this.onTerritorioChange('');
  }

  // Muestra un diálogo de confirmación antes de iniciar la importación
  async confirmarImportacion() {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar importación',
      subHeader: `Se importarán ${this.restaurantes.length} restaurantes`,
      message: 'Los datos actuales de Firebase serán borrados y reemplazados con los del archivo local. ¿Deseas continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sí, importar', role: 'confirm', handler: () => this.importarJSON() }
      ]
    });
    await alert.present();
  }
  /* H3.3 - Control y libertad del usuario.
     Permite recuperar un restaurante borrado accidentalmente. */
  // H4.3 - Formato de Toast unificado (siempre bottom, x para cerrar...)
  async mostrarToastDeshacer(restaurante: Restaurante) {
    const toast = await this.toastCtrl.create({
      message: 'Restaurante eliminado',
      duration: 6000,
      color: 'warning',
      position: 'bottom',
      buttons: [
        {
          text: 'Deshacer',
          handler: async () => {
            try {
              await this.restauranteService.restore(restaurante);
              await this.cargarDatos();
              await this.mostrarToast('Restaurante recuperado', 'success');
            } catch (error) {
              console.error(error);
              //// H9.4 — Reconocer, diagnosticar y recuperarse de errores. Error al deshacer borrado.
              await this.mostrarToast('Error al deshacer el borrado. Revisa tu conexión.', 'danger');
            }
          }
        }
      ]
    });

    await toast.present();
  }
  //Borra todos los datos de Firebase y sube los restaurantes del JSON local

  /* H1.1 - Visibilidad del estado del sistema.
     Muestra dos fases diferenciadas: borrado y progreso de importación. */
  async importarJSON() {

    this.importando.set(true);
    this.importados.set(0);

    const loading = await this.loadingCtrl.create({
      message: 'Borrando datos anteriores...',
      backdropDismiss: false
    });

    try {
      // FASE 1: Borrar datos anteriores
      await loading.present();
      await this.restauranteService.deleteAll();
      await loading.dismiss();

      // FASE 2: Mostrar modal de progreso
      // H1.1 - Informar visualmente del avance real de la subida.
      this.subiendo.set(true);

      await this.restauranteService.addAll(
        this.restaurantes,
        (cantidad) => {
          this.importados.set(cantidad);
        }
      );

      this.mostrarToast(
        `${this.restaurantes.length} restaurantes importados correctamente`,
        'success'
      );

    } catch (error: any) {
      console.error('Error al importar JSON:', error);
      // H9.1 — Reconocer, diagnosticar y recuperarse de errores. Sin permisos en Firebase
      // H9.2 — Reconocer, diagnosticar y recuperarse de errores. Error de red general
      const msg = error?.code === 'permission-denied'
        ? 'Sin permisos en Firebase. Revisa las reglas de seguridad.'
        : 'Error al importar. Revisa tu conexión a internet.';

      this.mostrarToast(msg, 'danger');

    } finally {
      await loading.dismiss();
      this.subiendo.set(false);
      this.importando.set(false);
    }
  }
  // Muestra confirmación y borra el restaurante indicado de Firebase y de la lista local
  async borrarRestaurante(r: Restaurante) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar borrado',
      subHeader: `¿Deseas borrar el restaurante ${r.documentName}?`,
      message: `Este proceso es irreversible`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar', role: 'confirm', cssClass: 'danger',
          handler: async () => {
            if (!r.id) {
              this.mostrarToast('No se puede borrar: el restaurante no tiene ID.', 'danger');
              return;
            }

            /* H1.3 - Visibilidad del estado del sistema.
               Creamos un overlay para informar al usuario
               mientras se elimina el restaurante de Firebase. */
            const loading = await this.loadingCtrl.create({
              message: 'Borrando restaurante...',
              backdropDismiss: false
            });

            await loading.present();

            try {
              await this.restauranteService.delete(r.id);

              this.restaurantesCargados.update(
                lista => lista.filter(x => x.id !== r.id)
              );

              //this.mostrarToast(`${r.documentName} eliminado`, 'success');

              // H3.3 - Ofrecemos deshacer después de borrar.
              await this.mostrarToastDeshacer(r);

            } catch {
              //// H9.3 — Reconocer, diagnosticar y recuperarse de errores. Error al borrar.
              this.mostrarToast('Error al borrar el restaurante. Revisa tu conexión.', 'danger');

            } finally {
              // H1.3 - Cerramos el overlay incluso si Firebase falla.
              await loading.dismiss();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // Abre el modal para añadir un restaurante nuevo
  async abrirModalAnadir() {
    const modal = await this.modalCtrl.create({
      component: AddRestauranteModalComponent,
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      await this.cargarDatos();
    }
  }

  /* Muestra un toast con el mensaje y color indicados
     H1.2 - Visibilidad del estado del sistema.
     Los mensajes de error permanecen visibles hasta
     que el usuario los cierra(H9.7 - Reconocer, diagnosticar y recuperarse de errores. Toasts de error persistentes);
    los de éxito duran 3 segundos. */

  // H4.3 - Formato de Toast unificado (siempre bottom, x para cerrar...)
  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: color === 'danger' ? 0 : 3000,
      color,
      position: 'bottom',
      buttons: [{ text: 'X', role: 'cancel' }]
    });
    await toast.present();
  }


  // ############################### REGION FILTROS (estado general) ###############################

  textoBusqueda = signal('');

  // true si hay algún filtro activo (texto, territorio o localidades)
  hayFiltrosActivos = computed(() =>
    !!this.textoBusqueda() ||
    !!this.territorioSeleccionado() ||
    this.localidadesSeleccionadas().length > 0
  );

  // Resetea todos los filtros a sus valores iniciales
  limpiarTodosFiltros() {
    this.textoBusqueda.set('');
    this.territorioSeleccionado.set('');
    this.localidadesSeleccionadas.set([]);
  }

  // ############################### REGION TERRITORIOS ###############################

  territorioSeleccionado = signal('');

  // Lista de territorios únicos disponibles, ordenada alfabéticamente
  territoriosFiltrados = computed(() => {
    const territorios = this.restaurantesCargados().map(r => r.territory);
    return Array.from(new Set(territorios)).sort();
  });

  // Actualiza el territorio seleccionado y elimina las localidades que ya no pertenecen a él
  onTerritorioChange(value: string) {
    this.territorioSeleccionado.set(value);
    const nuevasLocalidades = this.localidadesSeleccionadas().filter(loc =>
      this.localidadesFiltradasPorTerritorio().includes(loc)
    );
    this.localidadesSeleccionadas.set(nuevasLocalidades);
  }

  // ############################### REGION LOCALIDADES ###############################

  localidadesSeleccionadas = signal<string[]>([]);

  // Lista de localidades únicas del territorio seleccionado (o de todos si no hay territorio), ordenada alfabéticamente
  localidadesFiltradasPorTerritorio = computed(() => {
    let lista = this.restaurantesCargados();
    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory?.toLowerCase().trim() === territorio);
    }
    const localities = lista.map(r => r.locality?.trim()).filter((l): l is string => !!l);
    return Array.from(new Set(localities)).sort();
  });

  // Actualiza las localidades seleccionadas con los valores del evento
  onLocalidadesChange(value: string[]) {
    this.localidadesSeleccionadas.set(value);
  }

  // ############################### REGION RESULTADOS ###############################

  // Lista filtrada de restaurantes según todos los filtros activos
  restaurantesFiltrados = computed(() => {
    let lista = this.restaurantesCargados();

    const texto = this.textoBusqueda().toLowerCase().trim();
    if (texto) {
      lista = lista.filter(r => r.documentName.toLowerCase().includes(texto));
    }

    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory.toLowerCase().trim() === territorio);
    }

    const seleccionadas = this.localidadesSeleccionadas();
    if (seleccionadas.length > 0) {
      lista = lista.filter(r => seleccionadas.includes(r.locality?.trim() || ''));
    }

    return lista;
  });

  // ############################### REGION AUXILIARES ###############################

  // Devuelve el número de estrellas Michelin (0 si no tiene o el valor no es numérico)
  estrellasMichelin(r: Restaurante): number {
    return Number(r.michelinStar) || 0;
  }

  // Devuelve el número de soles Repsol (0 si no tiene o el valor no es numérico)
  repsolSoles(r: Restaurante): number {
    return Number(r.repsolSun) || 0;
  }
}