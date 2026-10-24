using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models;

public sealed class ActivationRequest
{
    [Required]
    public bool? IsActive { get; set; }
}