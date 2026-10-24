using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models;

public sealed class UpdateImageSortOrderRequest
{
    [Range(0, int.MaxValue)]
    public int SortOrder { get; set; }
}