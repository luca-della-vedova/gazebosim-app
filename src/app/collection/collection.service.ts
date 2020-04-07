import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { ErrorObservable } from 'rxjs/observable/ErrorObservable';

import { AuthService } from '../auth/auth.service';
import { Collection } from './collection';
import { FuelResource } from '../fuel-resource';
import { JsonClassFactoryService } from '../factory/json-class-factory.service';
import { PaginatedCollection } from './paginated-collection';
import { Model } from '../model/model';
import { World } from '../world/world';
import { PaginatedModels } from '../model/paginated-models';
import { PaginatedWorlds } from '../world/paginated-worlds';
import { UiError } from '../ui-error';

import * as linkParser from 'parse-link-header';

@Injectable()

/**
 * The Collection Service is in charge of making Collection related requests to the Fuel server.
 * TODO(german-mas): The Collection is another FuelResource, but it doesn't have files (nor
 * versions). Perhaps it should be useful to split the current FuelResource class to distinguish
 * between resources with and without files.
 */
export class CollectionService {

  /**
   * Private field used as a constant to represent X-Total-Count header name.
   */
  private static readonly headerTotalCount: string = 'X-Total-Count';

  /**
   * Base server URL, including version.
   */
  public baseUrl: string = `${API_HOST}/${API_VERSION}`;

  /**
   * @param authService Service to get authentication information.
   * @param factory Factory to transform Json into an object instance.
   * @param http Performs HTTP requests.
   */
  constructor(
    protected authService: AuthService,
    protected factory: JsonClassFactoryService,
    protected http: HttpClient) {
  }

  /**
   * Get a list of public collections.
   *
   * @param search An optional string to perform a partial search in the list.
   * @returns An observable with the list of public collections.
   */
  public getCollectionList(search?: string): Observable<PaginatedCollection> {
    let url = this.getCollectionListUrl();
    if (search) {
      url += `?q=:noft:${search}`;
    }
    return this.http.get(url, {observe: 'response'})
      .map((response) => {
        const paginatedCollection = new PaginatedCollection();
        paginatedCollection.totalCount = +response.headers.get(
          CollectionService.headerTotalCount);
        paginatedCollection.collections = this.factory.fromJson(response.body, Collection);
        paginatedCollection.nextPage = this.parseLinkHeader(response);
        return paginatedCollection;
      })
      .catch(this.handleError);
  }

  /**
   * Get a list of collections the authenticated user can extend.
   *
   * @param search An optional string to perform a partial search in the list.
   * @returns An observable with the list of collections the authenticated user can extend.
   */
  public getCollectionExtensibleList(search?: string): Observable<PaginatedCollection> {
    let url = `${this.getCollectionListUrl()}?extend=true`;
    if (search) {
      url += `&q=:noft:${search}`;
    }
    return this.http.get(url, {observe: 'response'})
      .map((response) => {
        const paginatedCollection = new PaginatedCollection();
        paginatedCollection.totalCount = +response.headers.get(
          CollectionService.headerTotalCount);
        paginatedCollection.collections = this.factory.fromJson(response.body, Collection);
        paginatedCollection.nextPage = this.parseLinkHeader(response);
        return paginatedCollection;
      })
      .catch(this.handleError);
  }

  /**
   * Get a a list of collections owned by a certain entity.
   *
   * @param owner The owner of the collections to get.
   * @returns An observable with the list of collections.
   */
  public getOwnerCollectionList(owner: string): Observable<PaginatedCollection> {
    const url = this.getOwnerCollectionListUrl(owner);
    return this.http.get(url, {observe: 'response'})
      .map((response) => {
        const paginatedCollection = new PaginatedCollection();
        paginatedCollection.totalCount = +response.headers.get(
          CollectionService.headerTotalCount);
        paginatedCollection.collections = this.factory.fromJson(response.body, Collection);
        paginatedCollection.nextPage = this.parseLinkHeader(response);
        return paginatedCollection;
      })
      .catch(this.handleError);
  }

  /**
   * Get a single collection.
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @returns An observable of the collection.
   */
  public getCollection(owner: string, name: string): Observable<Collection> {
    const url = this.getCollectionUrl(owner, name);
    return this.http.get<Collection>(url)
      .map((response) => {
        return this.factory.fromJson(response, Collection);
      })
      .catch(this.handleError);
  }

  /**
   * Get collection's models.
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @returns An observable of the collection's models.
   */
  public getCollectionModels(owner: string, name: string): Observable<PaginatedModels> {
    const url = this.getCollectionModelsUrl(owner, name);
    return this.http.get(url, {observe: 'response'})
      .map((response) => {
        const paginatedModels = new PaginatedModels();
        paginatedModels.totalCount = +response.headers.get(
          CollectionService.headerTotalCount);
        paginatedModels.resources = this.factory.fromJson(response.body, Model);
        paginatedModels.nextPage = this.parseLinkHeader(response);
        return paginatedModels;
      })
      .catch(this.handleError);
  }

  /**
   * Get collection's worlds.
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @returns An observable of the collection's worlds.
   */
  public getCollectionWorlds(owner: string, name: string): Observable<PaginatedWorlds> {
    const url = this.getCollectionWorldsUrl(owner, name);
    return this.http.get(url, {observe: 'response'})
      .map((response) => {
        const paginatedWorlds = new PaginatedWorlds();
        paginatedWorlds.totalCount = +response.headers.get(
          CollectionService.headerTotalCount);
        paginatedWorlds.resources = this.factory.fromJson(response.body, World);
        paginatedWorlds.nextPage = this.parseLinkHeader(response);
        return paginatedWorlds;
      })
      .catch(this.handleError);
  }

  /**
   * Create a collection.
   * Call the POST /collections route to submit a new collection.
   *
   * @param data The json data to be uploaded.
   * @returns An observable of the created collection.
   */
  public createCollection(data: object): Observable<Collection> {
    const url = this.getCollectionListUrl();
    return this.http.post(url, data)
      .map((response) => {
        return this.factory.fromJson(response, Collection);
      })
      .catch(this.handleError);
  }

  /**
   * Edit a collection.
   * Calls the PATCH /owner/collections/name route.
   *
   * @param owner The owner of the collection to edit.
   * @param name The name of the collection to edit.
   * @param form The form data to be edited from the collection.
   * @returns An observable of the edited collection.
   */
  public editCollection(owner: string, name: string, form: FormData): Observable<Collection> {
    const url = this.getCollectionUrl(owner, name);
    return this.http.patch<Collection>(url, form)
      .map((response) => {
        return this.factory.fromJson(response, Collection);
      })
      .catch(this.handleError);
  }

  /**
   * Remove a collection.
   * Calls the DELETE /owner/collections/name route.
   *
   * @param owner The owner of the collection to remove.
   * @param name The name of the collection to remove.
   * @returns An observable of the result.
   */
  public deleteCollection(owner: string, name: string): Observable<Collection> {
    const url = this.getCollectionUrl(owner, name);
    return this.http.delete(url)
      .catch(this.handleError);
  }

  /**
   * Add an asset to a collection.
   * Calls the POST /owner/collections/name/resourceType route, where the resource type can be
   * either models or worlds.
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @param resource The fuel resource to add to the collection.
   * @returns An observable of the result.
   */
  public addAsset(owner: string, name: string, resource: FuelResource): Observable<any> {
    const url = this.getAssetUrl(owner, name, resource);
    const data = {
      name: resource.name,
      owner: resource.owner
    };
    return this.http.post(url, data)
      .catch(this.handleError);
  }

  /**
   * Remove an asset from a collection.
   * Calls the DELETE /owner/collections/name/resourceType?o=resourceOwner&n=resourceName route,
   * where the resource type can be either models or worlds. The resource's name and owner are
   * passed as query parameters in the URL.
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @param resource The fuel resource to remove from the collection.
   * @returns An observable of the result.
   */
  public removeAsset(owner: string, name: string, resource: FuelResource): Observable<any> {
    const url = this.getDeleteAssetUrl(owner, name, resource);
    return this.http.delete(url)
      .catch(this.handleError);
  }

  /**
   * Get the collections that have an asset.
   * Calls the GET /resourceOwner/resourceType/resourceName/collections route.
   *
   * @param resource The resource contained by the collections.
   * @returns An observable of the paginated collections that have this resource.
   */
  public getAssetCollections(resource: FuelResource): Observable<PaginatedCollection> {
    const url = `${this.baseUrl}/${resource.owner}/${resource.type}/${resource.name}/collections`;
    return this.http.get(url, {observe: 'response'})
      .map((response) => {
        const paginatedCollection = new PaginatedCollection();
        paginatedCollection.totalCount = +response.headers.get(CollectionService.headerTotalCount);
        paginatedCollection.collections = this.factory.fromJson(response.body, Collection);
        paginatedCollection.nextPage = this.parseLinkHeader(response);
        return paginatedCollection;
      })
      .catch(this.handleError);
  }

  /**
   * Get the next page of collections from the Server. Used to use an infinite scroll.
   *
   * @param paginatedCollection The paginated collection to load the next page of.
   * @returns An observable of a paginated collection.
   */
  public getNextPage(paginatedCollection: PaginatedCollection): Observable<PaginatedCollection> {
    return this.http.get<PaginatedCollection>(paginatedCollection.nextPage, {observe: 'response'})
      .map((response) => {
        const res = new PaginatedCollection();
        res.totalCount = +response.headers.get(
          CollectionService.headerTotalCount);
        res.collections = this.factory.fromJson(response.body, Collection);
        res.nextPage = this.parseLinkHeader(response);
        return res;
      })
      .catch(this.handleError);
  }

  /**
   * Server route of the list of public collections.
   * Used to get a list of collections or create one.
   * The route is apiUrl/apiVersion/collections
   *
   * @returns The URL of the server route of the collections.
   */
  private getCollectionListUrl(): string {
    return `${this.baseUrl}/collections`;
  }

  /**
   * Server route of the list of collections owned by an entity.
   * The route is apiUrl/apiVersion/owner/collections
   *
   * @param owner The owner of the collections.
   * @returns The URL of the server route of the list of collections owned by the entity.
   */
  private getOwnerCollectionListUrl(owner: string): string {
    return `${this.baseUrl}/${owner}/collections`;
  }

  /**
   * Server route to a particular collection owned by an entity.
   * The route is apiUrl/apiVersion/owner/collections/collectionName
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @returns The URL of the server route of the collection.
   */
  private getCollectionUrl(owner: string, name: string): string {
    return `${this.getOwnerCollectionListUrl(owner)}/${name}`;
  }

  /**
   * Server route used to add a resource into a collection.
   * The route is apiUrl/apiVersion/owner/collections/collectionName/resourceType
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @param resource The fuel resource to add to the collection.
   * @returns The URL of the server route of the collection.
   */
  private getAssetUrl(owner: string, name: string, resource: FuelResource): string {
    return `${this.getCollectionUrl(owner, name)}/${resource.type}`;
  }

  /**
   * Server route used to remove a resource from a collection.
   * The route is apiUrl/apiVersion/owner/collections/collectionName/resourceType?
   *              o=resourceOwner&n=resourceName
   * Note that the resource's name and owner are passed as query parameters.
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @param resource The fuel resource to remove from the collection.
   * @returns The URL of the server route of the collection.
   */
  private getDeleteAssetUrl(owner: string, name: string, resource: FuelResource): string {
    return `${this.getAssetUrl(owner, name, resource)}?n=${resource.name}&o=${resource.owner}`;
  }

  /**
   * Server route to the list of models of a particular collection.
   * The route is apiUrl/apiVersion/owner/collections/collectionName/models
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @returns The URL of the server route of the collection's models.
   */
  private getCollectionModelsUrl(owner: string, name: string): string {
    return `${this.getCollectionUrl(owner, name)}/models`;
  }

  /**
   * Server route to the list of worlds of a particular collection.
   * The route is apiUrl/apiVersion/owner/collections/collectionName/worlds
   *
   * @param owner The owner of the collection.
   * @param name The name of the collection.
   * @returns The URL of the server route of the collection's worlds.
   */
  private getCollectionWorldsUrl(owner: string, name: string): string {
    return `${this.getCollectionUrl(owner, name)}/worlds`;
  }

  /**
   * Parses the Link Header of the response, in order to obtain the next URL
   * of the pagination.
   *
   * @param response The response that has a Link header to parse.
   * @returns The URL of the next page or null if there is none.
   */
  private parseLinkHeader(response: HttpResponse<any>): string {
    const link = response.headers.get('link');
    let nextUrl = null;
    if (link &&
      linkParser(link) &&
      linkParser(link).next) {
      const url = linkParser(link).next.url;
      nextUrl = `${API_HOST}${url}`;
    }
    return nextUrl;
  }

  /**
   * Error handling previous to subscription.
   *
   * To avoid code duplication in the components that use extensions of this service,
   * errors are thrown using an instance of the UiError class.
   *
   * @param response The HttpErrorResponse that contains the error.
   * @returns An error observable with a UiError, which contains error code to handle and
   * message to display.
   */
  private handleError(response: HttpErrorResponse): ErrorObservable {
    console.error('An error occurred', response);
    return Observable.throw(new UiError(response));
  }
}